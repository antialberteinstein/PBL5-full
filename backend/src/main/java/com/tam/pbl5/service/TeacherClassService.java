package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.TeacherAddStudentRequest;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.*;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class TeacherClassService {

    private final StudentClassRepository studentClassRepository;
    private final ClassRepository classRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final JwtService jwtService;

    /**
     * HÀM HỖ TRỢ: Tách và kiểm tra quyền Teacher từ Token
     */
    private Teacher getValidatedTeacher(String token) {
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        String role = jwtService.extractRole(token);
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Bạn không có quyền thực hiện thao tác này!");
        }
        String username = jwtService.extractUsername(token);
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        }
        return teacher;
    }

    @Transactional
    public String teacherAddStudent(TeacherAddStudentRequest request, String token) {
        Teacher teacher = getValidatedTeacher(token);

        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền quản lý lớp này!");
        }

        Student student = studentRepository.findByUsername(request.getStudentUsername());
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên '" + request.getStudentUsername() + "'");
        }

        StudentClass existingRecord = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());

        if (existingRecord != null) {
            if ("APPROVED".equalsIgnoreCase(existingRecord.getStatus())) {
                throw new RuntimeException("Lỗi: Sinh viên đã có trong lớp!");
            }
            existingRecord.setStatus("APPROVED");
            studentClassRepository.save(existingRecord);
            return "Đã duyệt sinh viên " + student.getUsername() + " vào lớp!";
        }

        StudentClass studentClass = new StudentClass();
        studentClass.setClassId(clazz.getId());
        studentClass.setStudentId(student.getId());
        studentClass.setStatus("APPROVED");
        studentClassRepository.save(studentClass);

        return "Đã thêm sinh viên " + student.getUsername() + " thành công!";
    }

    // ... Các hàm getPendingStudents, approveStudent, rejectStudent, getMyClasses
    // Khang cũng nên áp dụng hàm getValidatedTeacher(token) vào để rút gọn code nhé!

    @Transactional
    public String importStudentsFromExcel(Integer classId, MultipartFile file, String token) {
        Teacher teacher = getValidatedTeacher(token);

        Clazz clazz = classRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không sở hữu lớp học này!");
        }

        int successCount = 0;
        int failCount = 0;
        StringBuilder errorLog = new StringBuilder();
        DataFormatter formatter = new DataFormatter(); // Sử dụng Formatter vạn năng

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String studentUsername = "";
                try {
                    // Đọc MSSV từ cột A, tự động xử lý cả Số và Chữ
                    studentUsername = formatter.formatCellValue(row.getCell(0)).trim();

                    if (studentUsername.isEmpty()) continue; // Bỏ qua dòng trống

                    Student student = studentRepository.findByUsername(studentUsername);
                    if (student == null) {
                        throw new RuntimeException("Không tồn tại trên hệ thống.");
                    }

                    StudentClass existingRecord = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());

                    if (existingRecord != null) {
                        if ("APPROVED".equalsIgnoreCase(existingRecord.getStatus())) {
                            continue; // Đã có rồi thì bỏ qua, không tính là lỗi
                        }
                        existingRecord.setStatus("APPROVED");
                        studentClassRepository.save(existingRecord);
                    } else {
                        StudentClass studentClass = new StudentClass();
                        studentClass.setClassId(clazz.getId());
                        studentClass.setStudentId(student.getId());
                        studentClass.setStatus("APPROVED");
                        studentClassRepository.save(studentClass);
                    }
                    successCount++;

                } catch (Exception e) {
                    failCount++;
                    errorLog.append("Dòng ").append(i + 1).append(" [").append(studentUsername).append("]: ").append(e.getMessage()).append("\n");
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi đọc file: " + e.getMessage());
        }

        return String.format("Nhập danh sách hoàn tất!\n✅ Thành công: %d\n❌ Thất bại: %d\n%s",
                successCount, failCount, errorLog.length() > 0 ? "\nChi tiết lỗi:\n" + errorLog.toString() : "");
    }
}