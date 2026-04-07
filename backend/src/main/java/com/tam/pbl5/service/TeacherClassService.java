package com.tam.pbl5.service;
import java.util.List;
import com.tam.pbl5.dto.request.TeacherAddStudentRequest;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Student;
import com.tam.pbl5.entity.StudentClass;
import com.tam.pbl5.entity.Teacher;
import com.tam.pbl5.repository.ClassRepository;
import com.tam.pbl5.repository.StudentClassRepository;
import com.tam.pbl5.repository.StudentRepository;
import com.tam.pbl5.repository.TeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherClassService {

    private final StudentClassRepository studentClassRepository;
    private final ClassRepository classRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final JwtService jwtService;

    @Transactional
    public String teacherAddStudent(TeacherAddStudentRequest request, String token) {
        // 1. Tách Token
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        // 2. Giải mã Token
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        // 3. Phân quyền: Chỉ giáo viên
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép thêm sinh viên vào lớp!");
        }

        // 4. Tìm giáo viên
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        }

        // 5. Kiểm tra lớp học
        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        // 6. Kiểm tra quyền sở hữu lớp
        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền thêm sinh viên vào lớp của giáo viên khác!");
        }

        // 7. Tìm sinh viên cần thêm
        Student student = studentRepository.findByUsername(request.getStudentUsername());
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên có username là '" + request.getStudentUsername() + "'");
        }

        // 8. Kiểm tra xem sinh viên đã có bản ghi trong lớp chưa
        StudentClass existingRecord = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());

        if (existingRecord != null) {
            if ("APPROVED".equalsIgnoreCase(existingRecord.getStatus())) {
                throw new RuntimeException("Lỗi: Sinh viên này đã là thành viên chính thức của lớp rồi!");
            } else if ("PENDING".equalsIgnoreCase(existingRecord.getStatus())) {
                // Xử lý thông minh: Nếu đang chờ duyệt, tự động duyệt luôn
                existingRecord.setStatus("APPROVED");
                studentClassRepository.save(existingRecord);
                return "Sinh viên đang trong danh sách chờ. Đã tự động duyệt " + student.getUsername() + " vào lớp!";
            }
        }

        // 9. Nếu chưa có bản ghi nào, tạo mới và cho APPROVED (vào thẳng)
        StudentClass studentClass = new StudentClass();
        studentClass.setClassId(clazz.getId());
        studentClass.setStudentId(student.getId());
        studentClass.setStatus("APPROVED"); // Đặc quyền của giáo viên

        studentClassRepository.save(studentClass);

        return "Đã thêm trực tiếp sinh viên " + student.getUsername() + " vào lớp thành công!";
    }
    public List<Student> getPendingStudents(Integer classId, String token) {
        // 1. Tách Token
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        // 2. Giải mã Token
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        // 3. Phân quyền: Chỉ giáo viên
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được xem danh sách chờ duyệt!");
        }

        // 4. Tìm giáo viên đang thao tác
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        }

        // 5. Kiểm tra lớp học
        Clazz clazz = classRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        // 6. Kiểm tra bảo mật: Giáo viên chỉ được xem danh sách chờ của lớp mình dạy
        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền xem danh sách chờ của lớp giáo viên khác!");
        }

        // 7. Lấy danh sách các bản ghi đang PENDING trong lớp này
        List<StudentClass> pendingRecords = studentClassRepository.findByClassIdAndStatus(classId, "PENDING");

        // 8. Trích xuất danh sách studentId từ các bản ghi trên
        List<Integer> studentIds = pendingRecords.stream()
                .map(StudentClass::getStudentId)
                .collect(Collectors.toList());

        // 9. Lấy thông tin chi tiết của các sinh viên và trả về
        return studentRepository.findAllById(studentIds);
    }
    public String approveStudent(TeacherAddStudentRequest request, String token) {
        // 1. Tách và giải mã Token
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép duyệt học sinh!");
        }

        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");

        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền duyệt sinh viên cho lớp của người khác!");
        }

        // 2. Tìm ID sinh viên dựa vào username từ DTO gửi lên
        Student student = studentRepository.findByUsername(request.getStudentUsername());
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên có username: " + request.getStudentUsername());
        }

        // 3. Tìm bản ghi yêu cầu tham gia
        StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());

        if (studentClass == null) {
            throw new RuntimeException("Lỗi: Sinh viên này chưa gửi yêu cầu tham gia lớp!");
        }

        if ("APPROVED".equalsIgnoreCase(studentClass.getStatus())) {
            throw new RuntimeException("Lỗi: Sinh viên này đã được duyệt vào lớp từ trước rồi!");
        }

        // 4. Duyệt vào lớp
        studentClass.setStatus("APPROVED");
        studentClassRepository.save(studentClass);

        return "Đã duyệt sinh viên " + student.getUsername() + " vào lớp thành công!";
    }
    public String rejectStudent(TeacherAddStudentRequest request, String token) {
        // 1. Tách và giải mã Token
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép từ chối học sinh!");
        }

        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");

        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        // 2. Kiểm tra quyền chủ nhiệm
        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền từ chối sinh viên của lớp khác!");
        }

        // 3. Tìm ID sinh viên dựa vào username
        Student student = studentRepository.findByUsername(request.getStudentUsername());
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên có username: " + request.getStudentUsername());
        }

        // 4. Tìm bản ghi yêu cầu tham gia
        StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());

        if (studentClass == null) {
            throw new RuntimeException("Lỗi: Sinh viên này chưa gửi yêu cầu tham gia lớp!");
        }

        // 5. Xóa bản ghi (Từ chối thẳng tay)
        studentClassRepository.delete(studentClass);

        return "Đã từ chối yêu cầu tham gia lớp của sinh viên " + student.getUsername() + "!";
    }
    public List<Clazz> getMyClasses(String token) {
        // 1. Tách Token
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        // 2. Giải mã Token
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        // 3. Phân quyền
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Chỉ giáo viên mới xem được danh sách lớp của mình!");
        }

        // 4. Tìm Giáo viên
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) {
            throw new RuntimeException("Không tìm thấy thông tin giáo viên!");
        }

        // 5. Trả về danh sách lớp học dựa theo teacherId
        return classRepository.findByTeacherId(teacher.getId());
    }
}