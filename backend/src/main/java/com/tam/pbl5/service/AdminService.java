package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.AdminCreateUserRequest;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.apache.poi.ss.usermodel.*;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final ProfileRepository profileRepository;

    private final PasswordEncoder passwordEncoder;

    /**
     * Hàm tạo người dùng đơn lẻ
     * Có @Transactional để đảm bảo nếu lỗi 1 bước (ví dụ lưu Profile xong nhưng lưu User lỗi)
     * thì dữ liệu sẽ được quay xe (Rollback) sạch sẽ.
     */
    @Transactional
    public String adminCreateUser(AdminCreateUserRequest request) {

        // 1. Kiểm tra Username & Email
        if (userRepository.existsById(request.getUsername())) {
            throw new RuntimeException("Tên đăng nhập '" + request.getUsername() + "' đã tồn tại!");
        }
        if (profileRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email '" + request.getEmail() + "' đã được sử dụng!");
        }

        // 2. TẠO HỒ SƠ CÁ NHÂN (PROFILE)
        Profile profile = new Profile();
        profile.setFullName(request.getFullName());
        profile.setEmail(request.getEmail());
        Profile savedProfile = profileRepository.save(profile);

        // 3. TẠO TÀI KHOẢN ĐĂNG NHẬP (USER)
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEnabled(true);
        user.setProfile(savedProfile);
        userRepository.save(user);

        // 4. GÁN QUYỀN (AUTHORITY)
        Authority authority = new Authority();
        authority.setUsername(user.getUsername());
        authority.setAuthority("ROLE_" + request.getRole().toUpperCase());
        authorityRepository.save(authority);

        // 5. TẠO THẺ ĐỊNH DANH (TEACHER / STUDENT)
        if ("TEACHER".equalsIgnoreCase(request.getRole())) {
            Teacher teacher = new Teacher();
            teacher.setUsername(user.getUsername());
            teacherRepository.save(teacher);
        } else if ("STUDENT".equalsIgnoreCase(request.getRole())) {
            Student student = new Student();
            student.setUsername(user.getUsername());
            student.setFaceRegistered(false);
            studentRepository.save(student);
        } else {
            throw new RuntimeException("Role không hợp lệ! Chỉ chấp nhận TEACHER hoặc STUDENT.");
        }

        return "Thành công: " + request.getUsername();
    }

    /**
     * Hàm Import Excel
     * Không để @Transactional ở đây để dòng nào lỗi thì báo lỗi, dòng nào đúng thì vẫn lưu.
     */
    public String importUsersFromExcel(MultipartFile file) {
        int successCount = 0;
        int failCount = 0;
        StringBuilder errorLog = new StringBuilder();

        // Công cụ vạn năng để đọc mọi kiểu ô Excel thành String
        DataFormatter formatter = new DataFormatter();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);

            // Duyệt từ dòng 1 (bỏ qua tiêu đề)
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                try {
                    // Đọc và xóa khoảng trắng thừa (trim) để tránh lỗi dữ liệu ẩn
                    String username = formatter.formatCellValue(row.getCell(0)).trim();
                    String password = formatter.formatCellValue(row.getCell(1)).trim();
                    String email = formatter.formatCellValue(row.getCell(2)).trim();
                    String fullName = formatter.formatCellValue(row.getCell(3)).trim();
                    String role = formatter.formatCellValue(row.getCell(4)).trim();

                    if (username.isEmpty()) continue;

                    AdminCreateUserRequest request = AdminCreateUserRequest.builder()
                            .username(username)
                            .password(password)
                            .email(email)
                            .fullName(fullName)
                            .role(role)
                            .build();

                    // Gọi hàm tạo đơn lẻ
                    this.adminCreateUser(request);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errorLog.append("Dòng ").append(i).append(": ").append(e.getMessage()).append("\n");
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi nghiêm trọng khi đọc file: " + e.getMessage());
        }

        return String.format("Nhập dữ liệu hoàn tất! Thành công: %d, Thất bại: %d. \nChi tiết lỗi: \n%s",
                successCount, failCount, errorLog.toString());
    }
}