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

    @Transactional
    public String adminCreateUser(AdminCreateUserRequest request) {

        // 1. Kiểm tra Username & Email
        if (userRepository.existsById(request.getUsername())) {
            throw new RuntimeException("Lỗi: Tên đăng nhập '" + request.getUsername() + "' đã tồn tại!");
        }
        if (profileRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Lỗi: Email '" + request.getEmail() + "' đã được sử dụng!");
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

        // ==========================================
        // SỬA Ở ĐÂY: LƯU THẲNG VÀO BẢNG AUTHORITY CỦA KHANG
        // ==========================================
        Authority authority = new Authority();
        authority.setUsername(user.getUsername()); // Lấy tên user vừa tạo
        authority.setAuthority("ROLE_" + request.getRole().toUpperCase()); // Gán quyền (VD: ROLE_TEACHER)
        authorityRepository.save(authority);

        // 4. TẠO THẺ ĐỊNH DANH (TEACHER / STUDENT)
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
            throw new RuntimeException("Lỗi: Role không hợp lệ! Chỉ chấp nhận TEACHER hoặc STUDENT.");
        }

        return "Admin đã tạo thành công tài khoản " + request.getRole() + " cho: " + request.getUsername();
    }
    @Transactional
    public String importUsersFromExcel(MultipartFile file) {
        int successCount = 0;
        int failCount = 0;
        StringBuilder errorLog = new StringBuilder();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0); // Lấy sheet đầu tiên

            // Duyệt từng dòng (bỏ qua dòng tiêu đề index 0)
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                try {
                    // Đọc dữ liệu từ các cột (Cột 0: username, 1: password, 2: email, 3: full_name, 4: role)
                    AdminCreateUserRequest request = AdminCreateUserRequest.builder()
                            .username(row.getCell(0).getStringCellValue())
                            .password(String.valueOf(row.getCell(1).getStringCellValue()))
                            .email(row.getCell(2).getStringCellValue())
                            .fullName(row.getCell(3).getStringCellValue())
                            .role(row.getCell(4).getStringCellValue())
                            .build();

                    // Gọi lại hàm tạo người dùng đã viết trước đó
                    this.adminCreateUser(request);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errorLog.append("Dòng ").append(i).append(": ").append(e.getMessage()).append("\n");
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi đọc file Excel: " + e.getMessage());
        }

        return String.format("Nhập dữ liệu hoàn tất! Thành công: %d, Thất bại: %d. \nChi tiết lỗi: \n%s",
                successCount, failCount, errorLog.toString());
    }
}