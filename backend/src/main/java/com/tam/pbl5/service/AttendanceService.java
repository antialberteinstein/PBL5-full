package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.AttendanceCreateRequest;
import com.tam.pbl5.dto.request.StudentCheckinRequest;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final ClassRepository classRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final StudentClassRepository studentClassRepository;
    private final StudentAttendanceRepository studentAttendanceRepository;
    private final JwtService jwtService;

    // ==========================================
    // 1. GIÁO VIÊN TẠO BUỔI ĐIỂM DANH
    // ==========================================
    @Transactional
    public Attendance createAttendanceSession(AttendanceCreateRequest request, String token) { // ĐỔI TỪ String SANG Attendance
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép tạo buổi điểm danh!");
        }

        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");

        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền tạo điểm danh cho lớp của giáo viên khác!");
        }

        Attendance attendance = new Attendance();
        attendance.setClassId(clazz.getId());
        attendance.setDatetime(request.getDatetime() != null ? request.getDatetime() : LocalDateTime.now());

        // QUAN TRỌNG NHẤT LÀ DÒNG NÀY:
        // Lưu vào Database và TRẢ VỀ CHÍNH CUỐN SỔ VỪA TẠO (Bên trong nó đã có số ID)
        return attendanceRepository.save(attendance);
    }

    // ==========================================
    // 1B. LẤY DANH SÁCH BUỔI ĐIỂM DANH THEO LỚP
    // ==========================================
    public List<Attendance> getAttendanceByClass(Integer classId, String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        Clazz clazz = classRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if ("ROLE_TEACHER".equalsIgnoreCase(role)) {
            Teacher teacher = teacherRepository.findByUsername(username);
            if (teacher == null) {
                throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
            }

            if (!clazz.getTeacherId().equals(teacher.getId())) {
                throw new RuntimeException("Lỗi: Bạn không có quyền xem điểm danh của lớp khác!");
            }
        } else if ("ROLE_STUDENT".equalsIgnoreCase(role)) {
            Student student = studentRepository.findByUsername(username);
            if (student == null) {
                throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ sinh viên!");
            }

            StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), classId);
            if (studentClass == null || !"APPROVED".equalsIgnoreCase(studentClass.getStatus())) {
                throw new RuntimeException("Lỗi: Bạn không thuộc lớp này nên không được xem danh sách!");
            }
        } else {
            throw new RuntimeException("Lỗi: Không có quyền truy cập!");
        }

        return attendanceRepository.findByClassId(classId);
    }

    // ==========================================
    // 2. SINH VIÊN TỰ ĐIỂM DANH
    // ==========================================
    @Transactional
    public String studentCheckin(Integer attendanceId, String studentUsername) {

        // 1. Tìm sinh viên dựa vào Username do con AI gửi về (KHÔNG dùng Token nữa)
        Student student = studentRepository.findByUsername(studentUsername);
        if (student == null) {
            throw new RuntimeException("Lỗi: AI nhận diện ra mã '" + studentUsername + "' nhưng không có trong Database!");
        }

        // 2. Tìm buổi điểm danh
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

        // 3. Kiểm tra sinh viên có trong danh sách lớp không (APPROVED)
        StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), attendance.getClassId());
        if (studentClass == null || !"APPROVED".equalsIgnoreCase(studentClass.getStatus())) {
            throw new RuntimeException("Lỗi: Sinh viên " + studentUsername + " học nhầm lớp rồi!");
        }

        // 4. Kiểm tra chống spam (Camera quét 1 người nhiều lần trong 1 giây)
        if (studentAttendanceRepository.existsByAttendanceIdAndStudentId(attendance.getId(), student.getId())) {
            return "Sinh viên " + studentUsername + " đã được điểm danh trước đó."; // Không quăng lỗi để AI khỏi bị crash
        }

        // 5. Lưu xuống Database
        StudentAttendance checkin = new StudentAttendance();
        checkin.setAttendanceId(attendance.getId());
        checkin.setStudentId(student.getId());
        checkin.setCheckInTime(LocalDateTime.now());

        studentAttendanceRepository.save(checkin);

        return "AI Điểm danh thành công cho sinh viên: " + studentUsername;
    }
    public List<Student> getAttendedStudents(Integer attendanceId, String token) {
        // 1. Tách và giải mã Token
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        // 2. Tìm buổi điểm danh
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

        // 3. Phân quyền xem danh sách
        if ("ROLE_TEACHER".equalsIgnoreCase(role)) {
            // Nếu là Giáo viên: Phải là chủ nhiệm lớp này mới được xem
            Teacher teacher = teacherRepository.findByUsername(username);
            Clazz clazz = classRepository.findById(attendance.getClassId())
                    .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
            if (!clazz.getTeacherId().equals(teacher.getId())) {
                throw new RuntimeException("Lỗi: Bạn không có quyền xem danh sách điểm danh của lớp khác!");
            }
        } else if ("ROLE_STUDENT".equalsIgnoreCase(role)) {
            // Nếu là Sinh viên: Phải đang học lớp này mới được xem
            Student student = studentRepository.findByUsername(username);
            StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), attendance.getClassId());
            if (studentClass == null || !"APPROVED".equalsIgnoreCase(studentClass.getStatus())) {
                throw new RuntimeException("Lỗi: Bạn không thuộc lớp này nên không được xem danh sách!");
            }
        }

        // 4. Lấy danh sách các bản ghi điểm danh của buổi học này
        List<StudentAttendance> attendedRecords = studentAttendanceRepository.findByAttendanceId(attendanceId);

        // 5. Trích xuất ra 1 list chỉ chứa ID của các sinh viên đã điểm danh
        List<Integer> studentIds = attendedRecords.stream()
                .map(StudentAttendance::getStudentId)
                .collect(Collectors.toList());

        // 6. Dùng list ID đó để lấy thông tin chi tiết của sinh viên từ bảng Student
        return studentRepository.findAllById(studentIds);
    }
    // ==========================================
    // 4. XEM DANH SÁCH SINH VIÊN VẮNG MẶT
    // ==========================================
    public List<Student> getAbsentStudents(Integer attendanceId, String token) {
        // 1. Tách và giải mã Token
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        // 2. Tìm buổi điểm danh
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

        // 3. Phân quyền xem danh sách (Tương tự như hàm xem người đi học)
        if ("ROLE_TEACHER".equalsIgnoreCase(role)) {
            Teacher teacher = teacherRepository.findByUsername(username);
            Clazz clazz = classRepository.findById(attendance.getClassId())
                    .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
            if (!clazz.getTeacherId().equals(teacher.getId())) {
                throw new RuntimeException("Lỗi: Bạn không có quyền xem danh sách vắng của lớp khác!");
            }
        } else if ("ROLE_STUDENT".equalsIgnoreCase(role)) {
            Student student = studentRepository.findByUsername(username);
            StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), attendance.getClassId());
            if (studentClass == null || !"APPROVED".equalsIgnoreCase(studentClass.getStatus())) {
                throw new RuntimeException("Lỗi: Bạn không thuộc lớp này nên không được xem danh sách!");
            }
        }

        // 4. LẤY DANH SÁCH TẤT CẢ SINH VIÊN CHÍNH THỨC TRONG LỚP (APPROVED)
        List<StudentClass> allStudentsInClass = studentClassRepository.findByClassIdAndStatus(attendance.getClassId(), "APPROVED");
        List<Integer> allStudentIds = allStudentsInClass.stream()
                .map(StudentClass::getStudentId)
                .collect(Collectors.toList());

        // 5. LẤY DANH SÁCH NHỮNG NGƯỜI ĐÃ ĐIỂM DANH
        List<StudentAttendance> attendedRecords = studentAttendanceRepository.findByAttendanceId(attendanceId);
        List<Integer> attendedStudentIds = attendedRecords.stream()
                .map(StudentAttendance::getStudentId)
                .collect(Collectors.toList());

        // 6. TÌM RA NHỮNG NGƯỜI VẮNG MẶT (Có trong danh sách lớp nhưng KHÔNG CÓ trong danh sách điểm danh)
        List<Integer> absentStudentIds = allStudentIds.stream()
                .filter(id -> !attendedStudentIds.contains(id))
                .collect(Collectors.toList());

        // 7. Trả về thông tin chi tiết của các sinh viên vắng mặt
        return studentRepository.findAllById(absentStudentIds);
    }

    // ==========================================
    // 5. ĐÁNH DẤU TẤT CẢ SINH VIÊN CÓ MẶT
    // ==========================================
    @Transactional
    public String markAllPresent(Integer attendanceId, String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép cập nhật điểm danh!");
        }

        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        }

        Clazz clazz = classRepository.findById(attendance.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền cập nhật điểm danh cho lớp của giáo viên khác!");
        }

        List<Student> students = studentRepository.findAll();
        LocalDateTime now = LocalDateTime.now();
        int added = 0;

        for (Student student : students) {
            if (studentAttendanceRepository.existsByAttendanceIdAndStudentId(attendanceId, student.getId())) {
                continue;
            }

            StudentAttendance checkin = new StudentAttendance();
            checkin.setAttendanceId(attendanceId);
            checkin.setStudentId(student.getId());
            checkin.setCheckInTime(now);
            studentAttendanceRepository.save(checkin);
            added += 1;
        }

        return "Đã cập nhật điểm danh cho " + added + " sinh viên.";
    }

    // ==========================================
    // 6. GIÁO VIÊN GHI NHẬN ĐIỂM DANH TỪ VERIFY
    // ==========================================
    @Transactional
    public String teacherCheckin(
            Integer attendanceId,
            String studentUsername,
            String checkinTime,
            String token
    ) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép cập nhật điểm danh!");
        }

        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        }

        Clazz clazz = classRepository.findById(attendance.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền cập nhật điểm danh cho lớp của giáo viên khác!");
        }

        Student student = studentRepository.findByUsername(studentUsername);
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên có username: " + studentUsername);
        }

        if (studentAttendanceRepository.existsByAttendanceIdAndStudentId(attendanceId, student.getId())) {
            return "Sinh viên " + studentUsername + " đã được điểm danh trước đó.";
        }

        LocalDateTime checkinAt = LocalDateTime.now();
        if (checkinTime != null && !checkinTime.isBlank()) {
            try {
                checkinAt = LocalDateTime.parse(checkinTime);
            } catch (DateTimeParseException exc) {
                throw new RuntimeException("Lỗi: Định dạng checkinTime không hợp lệ!");
            }
        }

        StudentAttendance checkin = new StudentAttendance();
        checkin.setAttendanceId(attendanceId);
        checkin.setStudentId(student.getId());
        checkin.setCheckInTime(checkinAt);
        studentAttendanceRepository.save(checkin);

        return "Đã ghi nhận điểm danh cho sinh viên: " + studentUsername;
    }
}