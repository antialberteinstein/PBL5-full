package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.StudentJoinRequest;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Student;
import com.tam.pbl5.entity.StudentClass;
import com.tam.pbl5.repository.ClassRepository;
import com.tam.pbl5.repository.StudentClassRepository;
import com.tam.pbl5.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
    public class StudentClassService {

        private final StudentClassRepository studentClassRepository;
        private final ClassRepository classRepository;
        private final StudentRepository studentRepository;
        private final JwtService jwtService;

        @Transactional
        public String studentJoinClass(StudentJoinRequest request, String token) {
            // 1. Tách Token
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            // 2. Giải mã Token
            String username = jwtService.extractUsername(token);
            String role = jwtService.extractRole(token);

            // 3. Phân quyền: Chỉ sinh viên mới được gọi API này
            if (!"ROLE_STUDENT".equalsIgnoreCase(role)) {
                throw new RuntimeException("Lỗi: Chỉ sinh viên mới được phép gửi yêu cầu tham gia lớp học!");
            }

            // 4. Tìm hồ sơ sinh viên
            Student student = studentRepository.findByUsername(username);
            if (student == null) {
                throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ sinh viên!");
            }

            // 5. Kiểm tra lớp học có tồn tại không
            Clazz clazz = classRepository.findById(request.getClassId())
                    .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

            // 6. Kiểm tra xem sinh viên đã gửi yêu cầu hoặc đã ở trong lớp chưa
            StudentClass existingRecord = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());

            if (existingRecord != null) {
                if ("PENDING".equalsIgnoreCase(existingRecord.getStatus())) {
                    throw new RuntimeException("Bạn đã gửi yêu cầu tham gia lớp này rồi, vui lòng chờ giáo viên xét duyệt!");
                } else if ("APPROVED".equalsIgnoreCase(existingRecord.getStatus())) {
                    throw new RuntimeException("Bạn đã là thành viên chính thức của lớp học này rồi!");
                }
            }

            // 7. Tạo bản ghi mới với trạng thái PENDING
            StudentClass studentClass = new StudentClass();
            studentClass.setClassId(clazz.getId());
            studentClass.setStudentId(student.getId());
            studentClass.setStatus("PENDING"); // Đặt trạng thái chờ duyệt

            // 8. Lưu vào cơ sở dữ liệu
            studentClassRepository.save(studentClass);

            return "Đã gửi yêu cầu tham gia lớp thành công. Vui lòng chờ giáo viên xét duyệt!";
        }
    public List<Clazz> getMyJoinedClasses(String token) {
        // 1. Tách Token
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        // 2. Giải mã Token
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        // 3. Phân quyền: Chỉ cho phép sinh viên
        if (!"ROLE_STUDENT".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ sinh viên mới được xem danh sách lớp đã tham gia!");
        }

        // 4. Tìm sinh viên đang đăng nhập dựa vào username
        Student student = studentRepository.findByUsername(username);
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ sinh viên!");
        }

        // 5. Tìm các bản ghi liên kết lớp học có trạng thái APPROVED
        List<StudentClass> joinedRecords = studentClassRepository.findByStudentIdAndStatus(student.getId(), "APPROVED");

        // 6. Trích xuất ra một danh sách chỉ chứa ID của các lớp học đó
        List<Integer> classIds = joinedRecords.stream()
                .map(StudentClass::getClassId)
                .collect(Collectors.toList());

        // 7. SỬA LỖI Ở ĐÂY: Đổi 'clazzRepository' thành 'classRepository' cho khớp với khai báo ở trên
        return classRepository.findAllById(classIds);
    }

    @Transactional
    public String updateFaceRegistered(String token, boolean registered) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_STUDENT".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ sinh viên mới được cập nhật trạng thái đăng ký khuôn mặt!");
        }

        Student student = studentRepository.findByUsername(username);
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ sinh viên!");
        }

        student.setFaceRegistered(registered);
        studentRepository.save(student);

        return "Cập nhật trạng thái đăng ký khuôn mặt thành công.";
    }

    public Student getCurrentStudent(String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_STUDENT".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ sinh viên mới được xem thông tin này!");
        }

        Student student = studentRepository.findByUsername(username);
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ sinh viên!");
        }

        return student;
    }
    }