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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final ProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;

    // ✨ THÊM CÁC REPOSITORY ĐỂ QUẢN LÝ LỚP HỌC VÀ ĐIỂM DANH
    private final ClassRepository classRepository;
    private final StudentClassRepository studentClassRepository;
    private final AttendanceRepository attendanceRepository;
    private final StudentAttendanceRepository studentAttendanceRepository;

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
     */
    public String importUsersFromExcel(MultipartFile file, String role) { // Nhận thêm role
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
                    // Lấy giá trị chung cho Username và Code (MSSV/MSGV)
                    String identifier = formatter.formatCellValue(row.getCell(0)).trim();
                    String password   = formatter.formatCellValue(row.getCell(1)).trim();
                    String email      = formatter.formatCellValue(row.getCell(2)).trim();
                    String fullName   = formatter.formatCellValue(row.getCell(3)).trim();

                    if (identifier.isEmpty()) continue;

                    // Tạo request với role được truyền vào
                    AdminCreateUserRequest request = AdminCreateUserRequest.builder()
                            .username(identifier) // Username
                            .code(identifier)     // Code (MSSV/MSGV) lấy từ cùng 1 cột
                            .password(password)
                            .email(email)
                            .fullName(fullName)
                            .role(role)           // Sử dụng role được truyền vào từ FE
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

        return String.format("Nhập %s hoàn tất! Thành công: %d, Thất bại: %d.", role, successCount, failCount);
    }

    // ==========================================
    // CÁC HÀM MỚI: QUẢN LÝ LỚP HỌC (ADMIN)
    // ==========================================

    // Lấy toàn bộ danh sách lớp học
    public List<Clazz> getAllClasses() {
        return classRepository.findAll();
    }

    // Xem danh sách sinh viên chính thức trong 1 lớp
    public List<Student> getStudentsInClass(Integer classId) {
        List<StudentClass> studentClasses = studentClassRepository.findByClassIdAndStatus(classId, "APPROVED");
        if (studentClasses == null || studentClasses.isEmpty()) {
            return List.of();
        }
        List<Integer> studentIds = studentClasses.stream()
                .map(StudentClass::getStudentId)
                .collect(Collectors.toList());
        return studentRepository.findAllById(studentIds);
    }

    // Xóa lớp học (Kèm theo việc dọn dẹp lịch sử điểm danh và danh sách chờ duyệt)
    @Transactional
    public String deleteClass(Integer classId) {
        Clazz clazz = classRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Không tìm thấy lớp học có ID " + classId));

        // 1. Xóa các sinh viên đang ở trong lớp (bảng trung gian)
        List<StudentClass> studentClasses = studentClassRepository.findByClassIdAndStatus(classId, "APPROVED");
        studentClassRepository.deleteAll(studentClasses);

        // Xóa cả những yêu cầu đang PENDING của lớp này (nếu có)
        List<StudentClass> pendingClasses = studentClassRepository.findByClassIdAndStatus(classId, "PENDING");
        studentClassRepository.deleteAll(pendingClasses);

        // 2. Lấy các buổi điểm danh của lớp
        List<Attendance> attendances = attendanceRepository.findByClassId(classId);
        for (Attendance att : attendances) {
            // Xóa chi tiết điểm danh của từng sinh viên trong buổi đó
            List<StudentAttendance> records = studentAttendanceRepository.findByAttendanceId(att.getId());
            studentAttendanceRepository.deleteAll(records);
        }
        // Xóa các buổi điểm danh
        attendanceRepository.deleteAll(attendances);

        // 3. Xóa lớp
        classRepository.delete(clazz);

        return "Đã xóa thành công lớp học: " + clazz.getName() + " (ID: " + classId + ") và toàn bộ dữ liệu liên quan!";
    }

    // ==========================================
    // CÁC HÀM MỚI: QUẢN LÝ TÀI KHOẢN (ADMIN)
    // ==========================================

    // Lấy toàn bộ tài khoản (Trả về Map để bảo mật, không trả về password)
    public List<Map<String, Object>> getAllUsers() {
        List<User> users = userRepository.findAll();
        return users.stream().map(user -> {
            Map<String, Object> map = new HashMap<>();
            map.put("username", user.getUsername());

            // ✨ SỬA LỖI Ở ĐÂY: Đổi getEnabled() thành isEnabled()
            map.put("enabled", user.isEnabled());

            if (user.getProfile() != null) {
                map.put("fullName", user.getProfile().getFullName());
                map.put("email", user.getProfile().getEmail());
            }
            return map;
        }).collect(Collectors.toList());
    }   

    // Đặt lại mật khẩu cho User
    @Transactional
    public String resetUserPassword(String username, String newPassword) {
        User user = userRepository.findById(username)
                .orElseThrow(() -> new RuntimeException("Lỗi: Không tìm thấy người dùng " + username));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return "Đặt lại mật khẩu thành công cho tài khoản: " + username;
    }

    // Xóa hoàn toàn một tài khoản
    @Transactional
    public String deleteUser(String username) {
        User user = userRepository.findById(username)
                .orElseThrow(() -> new RuntimeException("Lỗi: Không tìm thấy người dùng " + username));

        // 1. Xóa Quyền
        try {
            authorityRepository.deleteById(username);
        } catch (Exception ignored) {} // Bỏ qua nếu cấu trúc khóa chính của bạn khác

        // 2. Xóa dữ liệu Student hoặc Teacher tương ứng
        Student student = studentRepository.findByUsername(username);
        if (student != null) {
            // Dọn dẹp dữ liệu học tập của Sinh viên
            List<StudentClass> joinedClasses = studentClassRepository.findByClassIdAndStatus(student.getId(), "APPROVED"); // Giả lập tìm qua ID
            studentClassRepository.deleteAll(joinedClasses);
            List<StudentAttendance> attendances = studentAttendanceRepository.findByAttendanceId(student.getId()); // Giả lập
            studentAttendanceRepository.deleteAll(attendances);
            studentRepository.delete(student);
        }

        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher != null) {
            // Cài đặt lớp của giáo viên này về null (Giữ lớp lại thay vì xóa)
            // Nếu bạn có hàm classRepository.findByTeacherId(teacher.getId()), hãy dùng nó. Ở đây mình quét toàn bộ cho an toàn:
            List<Clazz> allClasses = classRepository.findAll();
            for (Clazz c : allClasses) {
                if (c.getTeacherId() != null && c.getTeacherId().equals(teacher.getId())) {
                    c.setTeacherId(null);
                    classRepository.save(c);
                }
            }
            teacherRepository.delete(teacher);
        }

        // 3. Lấy Profile ID trước khi xóa User
        Integer profileId = user.getProfile() != null ? user.getProfile().getId() : null;

        // 4. Xóa User
        userRepository.delete(user);

        // 5. Xóa Profile
        if (profileId != null) {
            profileRepository.deleteById(profileId);
        }

        return "Đã xóa toàn bộ dữ liệu của tài khoản: " + username;
    }
}