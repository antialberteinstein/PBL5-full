package com.tam.pbl5.service;

import java.util.List;
import java.util.stream.Collectors;
import com.tam.pbl5.dto.request.ClassCreateRequest;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Student;
import com.tam.pbl5.entity.StudentClass;
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



    public List<Student> getApprovedStudentsInClass(Integer classId, String token) {
        // 1. Xác thực Token (Đảm bảo người gọi API đã đăng nhập)
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        jwtService.extractUsername(token); // Lỗi sẽ tự văng ra nếu token sai/hết hạn

        // 2. Tìm danh sách các bản ghi của lớp này nhưng CHỈ LẤY trạng thái APPROVED
        List<StudentClass> approvedRecords = studentClassRepository.findByClassIdAndStatus(classId, "APPROVED");

        // 3. Trích xuất ra một danh sách chỉ chứa ID của các sinh viên đó
        List<Integer> studentIds = approvedRecords.stream()
                .map(StudentClass::getStudentId)
                .collect(Collectors.toList());

        // 4. Dùng danh sách ID để chọc vào bảng Student lấy ra thông tin chi tiết
        return studentRepository.findAllById(studentIds);
        }

}