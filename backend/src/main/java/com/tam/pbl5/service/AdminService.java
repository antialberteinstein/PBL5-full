package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.AdminCreateUserRequest;
import com.tam.pbl5.dto.response.ImportJob;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import com.tam.pbl5.util.VietnameseText;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
    private final CameraRepository cameraRepository;
    private final RoomRepository roomRepository;

    // Cột bắt buộc trong Excel: key = slug không dấu của tiêu đề, value = tên hiển thị
    private static final Map<String, String> STUDENT_REQUIRED = new LinkedHashMap<>();
    private static final Map<String, String> TEACHER_REQUIRED = new LinkedHashMap<>();
    static {
        STUDENT_REQUIRED.put("mssv", "MSSV");
        STUDENT_REQUIRED.put("hovaten", "Họ và tên");
        STUDENT_REQUIRED.put("lop", "Lớp");
        STUDENT_REQUIRED.put("ngaysinh", "Ngày sinh");

        TEACHER_REQUIRED.put("hovaten", "Họ và tên");
        TEACHER_REQUIRED.put("sdt", "SĐT");
    }

    private static final DateTimeFormatter[] DATE_FORMATS = {
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy")
    };
    private static final DateTimeFormatter PASSWORD_DATE = DateTimeFormatter.ofPattern("ddMMyyyy");

    /**
     * Tạo một tài khoản đơn lẻ (admin thêm thủ công hoặc gọi từ import Excel).
     * - STUDENT: username = MSSV, password = DDMMYYYY (ngày sinh).
     * - TEACHER: username & password = họ tên không dấu viết liền (trùng thì nối số).
     */
    @Transactional
    public String adminCreateUser(AdminCreateUserRequest request) {
        String role = request.getRole() == null ? "" : request.getRole().trim().toUpperCase();
        String fullName = request.getFullName() == null ? "" : request.getFullName().trim();
        if (fullName.isEmpty()) {
            throw new RuntimeException("Họ và tên không được để trống!");
        }

        if ("STUDENT".equals(role)) {
            return createStudent(request, fullName);
        } else if ("TEACHER".equals(role)) {
            return createTeacher(request, fullName);
        }
        throw new RuntimeException("Role không hợp lệ! Chỉ chấp nhận TEACHER hoặc STUDENT.");
    }

    private String createStudent(AdminCreateUserRequest request, String fullName) {
        String mssv = request.getMssv() == null ? "" : request.getMssv().trim();
        if (mssv.isEmpty()) {
            throw new RuntimeException("MSSV không được để trống!");
        }
        if (request.getBirth() == null) {
            throw new RuntimeException("Ngày sinh không được để trống (dùng để tạo mật khẩu)!");
        }
        if (userRepository.existsById(mssv)) {
            throw new RuntimeException("Tài khoản (MSSV) '" + mssv + "' đã tồn tại!");
        }
        if (studentRepository.existsByMssv(mssv)) {
            throw new RuntimeException("MSSV '" + mssv + "' đã tồn tại trên hệ thống!");
        }

        String password = request.getBirth().format(PASSWORD_DATE); // DDMMYYYY

        Profile profile = new Profile();
        profile.setFullName(fullName);
        profile.setBirth(request.getBirth());
        Profile savedProfile = profileRepository.save(profile);

        User user = new User();
        user.setUsername(mssv);
        user.setPassword(passwordEncoder.encode(password));
        user.setEnabled(true);
        user.setProfile(savedProfile);
        userRepository.save(user);

        Authority authority = new Authority();
        authority.setUsername(mssv);
        authority.setAuthority("ROLE_STUDENT");
        authorityRepository.save(authority);

        Student student = new Student();
        student.setUsername(mssv);
        student.setMssv(mssv);
        student.setLopSinhHoat(request.getLopSinhHoat());
        student.setFaceRegistered(false);
        studentRepository.save(student);

        return "Sinh viên: " + mssv;
    }

    private String createTeacher(AdminCreateUserRequest request, String fullName) {
        String base = VietnameseText.toAsciiSlug(fullName);
        if (base.isEmpty()) {
            throw new RuntimeException("Họ và tên không hợp lệ để tạo tài khoản!");
        }
        // Trùng username thì nối hậu tố số; mật khẩu giữ nguyên slug họ tên
        String username = base;
        int suffix = 1;
        while (userRepository.existsById(username)) {
            suffix++;
            username = base + suffix;
        }

        Profile profile = new Profile();
        profile.setFullName(fullName);
        profile.setPhone(request.getPhone());
        Profile savedProfile = profileRepository.save(profile);

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(base)); // mật khẩu = họ tên không dấu
        user.setEnabled(true);
        user.setProfile(savedProfile);
        userRepository.save(user);

        Authority authority = new Authority();
        authority.setUsername(username);
        authority.setAuthority("ROLE_TEACHER");
        authorityRepository.save(authority);

        Teacher teacher = new Teacher();
        teacher.setUsername(username);
        teacherRepository.save(teacher);

        return "Giáo viên: " + username;
    }

    /**
     * Chạy job import Excel (gọi từ ImportJobService trên thread nền).
     * Tự cập nhật tiến trình (total/processed/succeeded/failed/errorLog) vào job.
     */
    public void runImportJob(byte[] fileBytes, ImportJob job) {
        String normRole = job.getRole();
        Map<String, String> required = "STUDENT".equals(normRole) ? STUDENT_REQUIRED : TEACHER_REQUIRED;
        DataFormatter formatter = new DataFormatter();

        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(fileBytes))) {
            // Evaluator để các ô FORMULA trả về giá trị kết quả thay vì chuỗi công thức
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            Sheet sheet = workbook.getSheetAt(0);

            // 1. Tìm hàng tiêu đề
            Map<String, Integer> colIndex = null;
            int headerRowIdx = -1;
            for (int i = 0; i <= sheet.getLastRowNum(); i++) {
                Map<String, Integer> candidate = headerSlugMap(sheet.getRow(i), formatter, evaluator);
                if (candidate.keySet().containsAll(required.keySet())) {
                    colIndex = candidate;
                    headerRowIdx = i;
                    break;
                }
            }
            if (colIndex == null) {
                Map<String, Integer> best = findBestHeader(sheet, formatter, evaluator, required);
                List<String> missing = new ArrayList<>();
                for (Map.Entry<String, String> e : required.entrySet()) {
                    if (best == null || !best.containsKey(e.getKey())) {
                        missing.add(e.getValue());
                    }
                }
                throw new RuntimeException("File Excel thiếu cột bắt buộc: " + String.join(", ", missing)
                        + ". Cần có đủ các cột: " + String.join(", ", required.values()) + ".");
            }

            // 2. Đếm sơ bộ số dòng có dữ liệu (để frontend hiển thị %)
            int total = 0;
            for (int i = headerRowIdx + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                boolean hasData = false;
                for (Integer col : colIndex.values()) {
                    if (col != null && !cellStr(formatter, evaluator, row, col).isEmpty()) {
                        hasData = true;
                        break;
                    }
                }
                if (hasData) total++;
            }
            job.setTotal(total);

            // 3. Xử lý từng dòng và cập nhật tiến trình
            for (int i = headerRowIdx + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                try {
                    AdminCreateUserRequest req;
                    if ("STUDENT".equals(normRole)) {
                        String mssv = cellStr(formatter, evaluator, row, colIndex.get("mssv"));
                        String fullName = cellStr(formatter, evaluator, row, colIndex.get("hovaten"));
                        String lop = cellStr(formatter, evaluator, row, colIndex.get("lop"));
                        if (mssv.isEmpty() && fullName.isEmpty()) continue; // dòng trống
                        LocalDate birth = parseDate(row.getCell(colIndex.get("ngaysinh")), formatter, evaluator);
                        req = AdminCreateUserRequest.builder()
                                .role("STUDENT").mssv(mssv).fullName(fullName)
                                .lopSinhHoat(lop).birth(birth).build();
                    } else {
                        String fullName = cellStr(formatter, evaluator, row, colIndex.get("hovaten"));
                        String phone = cellStr(formatter, evaluator, row, colIndex.get("sdt"));
                        if (fullName.isEmpty()) continue; // dòng trống
                        req = AdminCreateUserRequest.builder()
                                .role("TEACHER").fullName(fullName).phone(phone).build();
                    }
                    this.adminCreateUser(req);
                    job.setSucceeded(job.getSucceeded() + 1);
                } catch (Exception e) {
                    job.setFailed(job.getFailed() + 1);
                    job.appendErrorLine("Dòng " + (i + 1) + ": " + e.getMessage());
                } finally {
                    job.setProcessed(job.getProcessed() + 1);
                }
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi nghiêm trọng khi đọc file: " + e.getMessage());
        }
    }

    // Loại kết quả thật của cell (xử lý cả FORMULA -> lấy kiểu kết quả đã cache)
    private CellType effectiveType(Cell cell) {
        if (cell == null) return CellType._NONE;
        CellType t = cell.getCellType();
        return t == CellType.FORMULA ? cell.getCachedFormulaResultType() : t;
    }

    // Map slug-tiêu-đề -> chỉ số cột của một hàng (đánh giá công thức khi cần)
    private Map<String, Integer> headerSlugMap(Row row, DataFormatter formatter, FormulaEvaluator evaluator) {
        Map<String, Integer> map = new HashMap<>();
        if (row == null) return map;
        for (int c = row.getFirstCellNum(); c >= 0 && c < row.getLastCellNum(); c++) {
            String slug = VietnameseText.toAsciiSlug(formatter.formatCellValue(row.getCell(c), evaluator));
            if (!slug.isEmpty() && !map.containsKey(slug)) {
                map.put(slug, c);
            }
        }
        return map;
    }

    // Tìm hàng giống tiêu đề nhất (nhiều cột bắt buộc nhất) để liệt kê cột thiếu
    private Map<String, Integer> findBestHeader(Sheet sheet, DataFormatter formatter,
                                                FormulaEvaluator evaluator,
                                                Map<String, String> required) {
        Map<String, Integer> best = null;
        int bestScore = -1;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Map<String, Integer> candidate = headerSlugMap(sheet.getRow(i), formatter, evaluator);
            int score = 0;
            for (String key : required.keySet()) {
                if (candidate.containsKey(key)) score++;
            }
            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        return best;
    }

    private String cellStr(DataFormatter formatter, FormulaEvaluator evaluator, Row row, Integer col) {
        if (col == null) return "";
        Cell cell = row.getCell(col);
        if (cell == null) return "";
        // Với FORMULA cell, lấy kiểu kết quả; nếu numeric không phải date -> giữ dạng số nguyên đẹp
        CellType type = effectiveType(cell);
        if (type == CellType.NUMERIC && !DateUtil.isCellDateFormatted(cell)) {
            double d = cell.getNumericCellValue();
            if (d == Math.floor(d) && !Double.isInfinite(d)) {
                return String.valueOf((long) d);
            }
        }
        // formatter có evaluator => với FORMULA cell sẽ trả về kết quả tính, không phải công thức gốc
        return formatter.formatCellValue(cell, evaluator).trim();
    }

    private LocalDate parseDate(Cell cell, DataFormatter formatter, FormulaEvaluator evaluator) {
        if (cell == null) throw new RuntimeException("Thiếu ngày sinh!");
        CellType type = effectiveType(cell);
        if (type == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }
        String raw = formatter.formatCellValue(cell, evaluator).trim();
        if (raw.isEmpty()) throw new RuntimeException("Thiếu ngày sinh!");
        for (DateTimeFormatter f : DATE_FORMATS) {
            try {
                return LocalDate.parse(raw, f);
            } catch (DateTimeParseException ignored) {
            }
        }
        throw new RuntimeException("Ngày sinh '" + raw + "' không đúng định dạng (dd/MM/yyyy)!");
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

    // Lấy toàn bộ tài khoản (kèm vai trò, không trả về password)
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllUsers() {
        List<User> users = userRepository.findAll();
        // Pre-load authorities theo batch
        Map<String, String> roleByUsername = new HashMap<>();
        authorityRepository.findAll().forEach(a -> roleByUsername.put(a.getUsername(), a.getAuthority()));

        return users.stream().map(user -> {
            Map<String, Object> map = new HashMap<>();
            map.put("username", user.getUsername());
            map.put("enabled", user.isEnabled());
            Profile p = user.getProfile();
            map.put("fullName", p != null ? p.getFullName() : null);
            map.put("role", roleByUsername.get(user.getUsername()));
            return map;
        }).collect(Collectors.toList());
    }

    // Danh sách sinh viên cho tab "Quản lý sinh viên"
    @Transactional(readOnly = true)
    public Map<String, Long> getSystemStats() {
        Map<String, Long> stats = new HashMap<>();
        stats.put("students", studentRepository.count());
        stats.put("teachers", teacherRepository.count());
        stats.put("classes", classRepository.count());
        stats.put("cameras", cameraRepository.count());
        return stats;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllStudents() {
        List<Student> studentList = studentRepository.findAll();
        // Pre-fetch users theo batch để giữ session mở khi đọc Profile (eager)
        List<String> usernames = studentList.stream()
                .map(Student::getUsername)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
        Map<String, User> userByName = userRepository.findAllById(usernames).stream()
                .collect(Collectors.toMap(User::getUsername, u -> u, (a, b) -> a));

        return studentList.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("username", s.getUsername());
            map.put("mssv", s.getMssv());
            map.put("lopSinhHoat", s.getLopSinhHoat());
            map.put("faceRegistered", s.isFaceRegistered());
            User u = userByName.get(s.getUsername());
            if (u != null) {
                map.put("enabled", u.isEnabled());
                Profile p = u.getProfile();
                map.put("fullName", p != null ? p.getFullName() : null);
                map.put("birth", p != null ? p.getBirth() : null);
            } else {
                map.put("fullName", null);
            }
            return map;
        }).collect(Collectors.toList());
    }

    // Danh sách giáo viên cho tab "Quản lý giáo viên"
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllTeachers() {
        List<Teacher> teacherList = teacherRepository.findAll();
        List<String> usernames = teacherList.stream()
                .map(Teacher::getUsername)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
        Map<String, User> userByName = userRepository.findAllById(usernames).stream()
                .collect(Collectors.toMap(User::getUsername, u -> u, (a, b) -> a));

        return teacherList.stream().map(t -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", t.getId());
            map.put("username", t.getUsername());
            map.put("msgv", t.getMsgv());
            User u = userByName.get(t.getUsername());
            if (u != null) {
                map.put("enabled", u.isEnabled());
                Profile p = u.getProfile();
                map.put("fullName", p != null ? p.getFullName() : null);
                map.put("phone", p != null ? p.getPhone() : null);
            } else {
                map.put("fullName", null);
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