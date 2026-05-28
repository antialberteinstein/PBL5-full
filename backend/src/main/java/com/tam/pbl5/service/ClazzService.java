package com.tam.pbl5.service;

import java.util.List;
 import java.util.stream.Collectors; // Không cần dùng cái này nữa
import com.tam.pbl5.dto.request.ClassCreateRequest;
import com.tam.pbl5.dto.response.StudentInClassProjection; // LƯU Ý: Thêm import Projection
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Teacher;
import com.tam.pbl5.repository.ClassRepository;
import com.tam.pbl5.repository.TeacherRepository;

// LƯU Ý: Thêm 2 import này vào
import com.tam.pbl5.repository.StudentClassRepository;
import com.tam.pbl5.repository.StudentRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClazzService {

    private final ClassRepository clazzRepository;
    private final TeacherRepository teacherRepository;
    private final JwtService jwtService;

    // LƯU Ý: Khai báo thêm 2 biến này để dùng trong hàm getApprovedStudentsInClass
    private final StudentClassRepository studentClassRepository;
    private final StudentRepository studentRepository;

    @Transactional
    public Clazz createNewClass(ClassCreateRequest request, String token) {
        // 1. Loại bỏ "Bearer " khỏi chuỗi token gửi từ Header
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        // 2. Giải mã lấy thông tin từ Token thông qua JwtService
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        // 3. Phân quyền: Chỉ cho phép ROLE_TEACHER
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới có quyền tạo lớp học!");
        }

        // 4. Tìm Teacher ID dựa trên username lấy từ Token
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên cho user: " + username);
        }

        // 5. Khởi tạo Entity Clazz và lưu vào Database
        Clazz newClass = new Clazz();
        newClass.setName(request.getName());
        newClass.setTeacherId(teacher.getId()); // Gán ID của giáo viên (kiểu số)

        return clazzRepository.save(newClass);
    }

    public Clazz getClassById(Integer classId, String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        jwtService.extractUsername(token);

        return clazzRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
    }

    // ĐÃ SỬA: Đổi kiểu trả về từ List<Student> thành List<StudentInClassProjection>
    public List<StudentInClassProjection> getApprovedStudentsInClass(Integer classId, String token) {
        // 1. Xác thực Token (Đảm bảo người gọi API đã đăng nhập)
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        jwtService.extractUsername(token); // Lỗi sẽ tự văng ra nếu token sai/hết hạn

        // 2. Gọi thẳng hàm Native Query nối 4 bảng để lấy ra danh sách có chứa fullName
        return studentClassRepository.findStudentsByClassAndStatus(classId, "APPROVED");
    }

}