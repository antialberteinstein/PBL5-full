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
     * Đã cập nhật logic kiểm tra mã định danh (code) dựa trên Role
     */
    @Transactional
    public String adminCreateUser(AdminCreateUserRequest request) {

        // 1. KIỂM TRA CHUNG (Username & Email)
        if (userRepository.existsById(request.getUsername())) {
            throw new RuntimeException("Tên đăng nhập '" + request.getUsername() + "' đã tồn tại!");
        }
        if (profileRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email '" + request.getEmail() + "' đã được sử dụng!");
        }

        // 2. KIỂM TRA MÃ ĐỊNH DANH (Code) DỰA TRÊN ROLE
        String inputCode = (request.getCode() != null) ? request.getCode().trim() : "";
        if (inputCode.isEmpty()) {
            throw new RuntimeException("Lỗi: Mã số định danh (MSSV/MSGV) không được để trống!");
        }

        // Kiểm tra trùng mã trong từng bảng tương ứng
        if ("STUDENT".equalsIgnoreCase(request.getRole())) {
            if (studentRepository.existsByMssv(inputCode)) {
                throw new RuntimeException("Lỗi: MSSV '" + inputCode + "' đã tồn tại trên hệ thống!");
            }
        } else if ("TEACHER".equalsIgnoreCase(request.getRole())) {
            if (teacherRepository.existsByMsgv(inputCode)) {
                throw new RuntimeException("Lỗi: Mã giáo viên '" + inputCode + "' đã tồn tại trên hệ thống!");
            }
        } else {
            throw new RuntimeException("Role không hợp lệ! Chỉ chấp nhận TEACHER hoặc STUDENT.");
        }

        // 3. TẠO HỒ SƠ CÁ NHÂN (PROFILE)
        Profile profile = new Profile();
        profile.setFullName(request.getFullName());
        profile.setEmail(request.getEmail());
        Profile savedProfile = profileRepository.save(profile);

        // 4. TẠO TÀI KHOẢN ĐĂNG NHẬP (USER)
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEnabled(true);
        user.setProfile(savedProfile);
        userRepository.save(user);

        // 5. GÁN QUYỀN (AUTHORITY)
        Authority authority = new Authority();
        authority.setUsername(user.getUsername());
        authority.setAuthority("ROLE_" + request.getRole().toUpperCase());
        authorityRepository.save(authority);

        // 6. LƯU VÀO BẢNG ĐỊNH DANH CHI TIẾT (TEACHER / STUDENT)
        if ("TEACHER".equalsIgnoreCase(request.getRole())) {
            Teacher teacher = new Teacher();
            teacher.setUsername(user.getUsername());
            teacher.setMsgv(inputCode); // Gán code vào cột msgv
            teacherRepository.save(teacher);
        } else {
            Student student = new Student();
            student.setUsername(user.getUsername());
            student.setMssv(inputCode); // Gán code vào cột mssv
            student.setFaceRegistered(false);
            studentRepository.save(student);
        }

        return "Thành công: " + request.getUsername();
    }

    /**
     * Hàm Import Excel
     * Cấu trúc file mẫu mong muốn:
     * Cột 0: Username | Cột 1: Mã số (MSSV/MSGV) | Cột 2: Password | Cột 3: Email | Cột 4: FullName | Cột 5: Role
     */
    public String importUsersFromExcel(MultipartFile file) {
        int successCount = 0;
        int failCount = 0;
        StringBuilder errorLog = new StringBuilder();
        DataFormatter formatter = new DataFormatter();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                try {
                    // Đọc dữ liệu theo cấu trúc cột mới
                    String username = formatter.formatCellValue(row.getCell(0)).trim();
                    String code     = formatter.formatCellValue(row.getCell(1)).trim(); // Lấy mã số
                    String password = formatter.formatCellValue(row.getCell(2)).trim();
                    String email    = formatter.formatCellValue(row.getCell(3)).trim();
                    String fullName = formatter.formatCellValue(row.getCell(4)).trim();
                    String role     = formatter.formatCellValue(row.getCell(5)).trim();

                    if (username.isEmpty()) continue;

                    AdminCreateUserRequest request = AdminCreateUserRequest.builder()
                            .username(username)
                            .code(code) // Đưa mã vào trường code chung
                            .password(password)
                            .email(email)
                            .fullName(fullName)
                            .role(role)
                            .build();

                    this.adminCreateUser(request);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errorLog.append("Dòng ").append(i + 1).append(": ").append(e.getMessage()).append("\n");
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi nghiêm trọng khi đọc file: " + e.getMessage());
        }

        return String.format("Nhập dữ liệu hoàn tất! Thành công: %d, Thất bại: %d. \n%s",
                successCount, failCount, errorLog.length() > 0 ? "Chi tiết lỗi:\n" + errorLog : "");
    }
}