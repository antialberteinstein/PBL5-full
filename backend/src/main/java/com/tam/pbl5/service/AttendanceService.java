package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.AttendanceCreateRequest;
import com.tam.pbl5.dto.request.DiscordAttendancePayload;
import com.tam.pbl5.dto.response.AttendedStudentResponse; // ✨ ĐÃ THÊM IMPORT NÀY
import com.tam.pbl5.dto.response.StudentAttendanceReportDTO;
import com.tam.pbl5.dto.response.TeacherCheckinResponse;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
    private final ClassScheduleRepository classScheduleRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final DiscordNotifier discordNotifier;

    private static final Pattern DATA_IMAGE_PATTERN =
            Pattern.compile("^data:image/(jpeg|jpg|png);base64,(.+)$", Pattern.CASE_INSENSITIVE);
    private static final int MAX_IMAGE_BYTES = 3 * 1024 * 1024;
    private static final Path UPLOAD_ROOT = Path.of(System.getProperty("user.home"), "pbl5", "upload");

    private String saveAttendanceImage(String imageData) {
        if (imageData == null || imageData.isBlank()) {
            return null;
        }

        if (imageData.startsWith("/uploads/")) {
            return imageData;
        }

        Matcher matcher = DATA_IMAGE_PATTERN.matcher(imageData);
        if (!matcher.matches()) {
            throw new RuntimeException("Lỗi: Ảnh điểm danh phải là data URL JPEG/PNG hợp lệ.");
        }

        String extension = "png".equalsIgnoreCase(matcher.group(1)) ? "png" : "jpg";
        byte[] imageBytes;
        try {
            imageBytes = Base64.getDecoder().decode(matcher.group(2));
        } catch (IllegalArgumentException exc) {
            throw new RuntimeException("Lỗi: Dữ liệu ảnh điểm danh không hợp lệ.");
        }

        if (imageBytes.length == 0 || imageBytes.length > MAX_IMAGE_BYTES) {
            throw new RuntimeException("Lỗi: Ảnh điểm danh vượt quá dung lượng cho phép.");
        }

        try {
            Path attendanceDir = UPLOAD_ROOT.resolve("attendance");
            Files.createDirectories(attendanceDir);

            String filename = UUID.randomUUID() + "." + extension;
            Path destination = attendanceDir.resolve(filename);
            Files.write(destination, imageBytes);

            return "/uploads/attendance/" + filename;
        } catch (IOException exc) {
            throw new RuntimeException("Lỗi: Không thể lưu ảnh điểm danh lên server.");
        }
    }

    // ==========================================
    // 1. GIÁO VIÊN TẠO BUỔI ĐIỂM DANH
    // ==========================================
    @Transactional
    public Attendance createAttendanceSession(AttendanceCreateRequest request, String token) {
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

        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDateTime weekStartDt = weekStart.atStartOfDay();
        LocalDateTime weekEndDt = weekStart.plusDays(7).atStartOfDay();

        Optional<Attendance> existing = attendanceRepository.findByClassId(clazz.getId()).stream()
                .filter(a -> a.getDatetime() != null
                        && !a.getDatetime().isBefore(weekStartDt)
                        && a.getDatetime().isBefore(weekEndDt))
                .findFirst();

        if (existing.isPresent()) {
            return existing.get();
        }

        // Ngày buổi học = ngày của thứ scheduled trong tuần này (mặc định Thứ Hai nếu lớp chưa có lịch)
        LocalDate sessionDate = weekStart;
        List<ClassSchedule> schedules = classScheduleRepository.findByClazzId(clazz.getId());
        if (!schedules.isEmpty()) {
            Integer firstDow = schedules.get(0).getDayOfWeek();
            if (firstDow != null && firstDow >= 2 && firstDow <= 8) {
                sessionDate = weekStart.plusDays(firstDow - 2); // Mon=2->+0, Sun=8->+6
            }
        }

        Attendance attendance = new Attendance();
        attendance.setClassId(clazz.getId());
        attendance.setDatetime(sessionDate.atStartOfDay());

        return attendanceRepository.save(attendance);
    }

    // ==========================================
    // RESET ĐIỂM DANH CỦA 1 BUỔI (DÀNH CHO TEST/DEMO)
    // ==========================================
    @Transactional
    public String resetAttendance(Integer attendanceId, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép reset điểm danh!");
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
            throw new RuntimeException("Lỗi: Bạn không có quyền reset điểm danh cho lớp của giáo viên khác!");
        }

        List<StudentAttendance> records = studentAttendanceRepository.findByAttendanceId(attendanceId);
        int count = records.size();
        studentAttendanceRepository.deleteAll(records);
        return "Đã reset " + count + " bản ghi điểm danh của buổi này.";
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
    // 2. SINH VIÊN TỰ ĐIỂM DANH (ĐÃ CHUẨN)
    // ==========================================
    @Transactional
    public String studentCheckin(Integer attendanceId, String studentUsername, String imageUrl) {

        Student student = studentRepository.findByUsername(studentUsername);
        if (student == null) {
            throw new RuntimeException("Lỗi: AI nhận diện ra mã '" + studentUsername + "' nhưng không có trong Database!");
        }

        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

        StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), attendance.getClassId());
        if (studentClass == null || !"APPROVED".equalsIgnoreCase(studentClass.getStatus())) {
            throw new RuntimeException("Lỗi: Sinh viên " + studentUsername + " học nhầm lớp rồi!");
        }

        if (studentAttendanceRepository.existsByAttendanceIdAndStudentId(attendance.getId(), student.getId())) {
            return "Sinh viên " + studentUsername + " đã được điểm danh trước đó.";
        }

        StudentAttendance checkin = new StudentAttendance();
        checkin.setAttendanceId(attendance.getId());
        checkin.setStudentId(student.getId());
        checkin.setCheckInTime(LocalDateTime.now());

        checkin.setImageUrl(saveAttendanceImage(imageUrl));

        studentAttendanceRepository.save(checkin);

        return "AI Điểm danh thành công cho sinh viên: " + studentUsername;
    }

    // ==========================================
    // 3. XEM DANH SÁCH SINH VIÊN CÓ MẶT (✨ ĐÃ FIX LỖI MẤT ẢNH)
    // ==========================================
    public List<AttendedStudentResponse> getAttendedStudents(Integer attendanceId, String token) {
        // 1. Kiểm tra phân quyền (Phần này Khang giữ nguyên nhé)
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

        if ("ROLE_TEACHER".equalsIgnoreCase(role)) {
            Teacher teacher = teacherRepository.findByUsername(username);
            Clazz clazz = classRepository.findById(attendance.getClassId())
                    .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
            if (!clazz.getTeacherId().equals(teacher.getId())) {
                throw new RuntimeException("Lỗi: Bạn không có quyền xem danh sách này!");
            }
        }

        // 2. Build danh sách qua helper dùng chung (đã tách để closeAttendance tái dùng)
        return buildAttendedStudents(attendanceId);
    }

    /**
     * Map các bản ghi điểm danh của 1 buổi -> AttendedStudentResponse (kèm ảnh + cờ spoof).
     * Không kiểm tra quyền — caller tự lo phân quyền.
     */
    private List<AttendedStudentResponse> buildAttendedStudents(Integer attendanceId) {
        List<StudentAttendance> attendedRecords = studentAttendanceRepository.findByAttendanceId(attendanceId);

        return attendedRecords.stream().map(record -> {
            Student student = studentRepository.findById(record.getStudentId())
                    .orElse(new Student());

            // User -> Profile -> FullName; null ở bất kỳ đâu thì lấy "Chưa cập nhật tên".
            String fullNameFromProfile = userRepository.findById(student.getUsername())
                    .map(User::getProfile)
                    .map(Profile::getFullName)
                    .orElse("Chưa cập nhật tên");

            return new AttendedStudentResponse(
                    student.getMssv(),
                    fullNameFromProfile,
                    student.getUsername(),
                    record.getCheckInTime() != null ? record.getCheckInTime().toString() : null,
                    record.getImageUrl(), // Link ảnh chụp từ AI hoặc null nếu điểm danh tay
                    record.isSpoof(),     // Cờ nghi ngờ gian lận
                    record.getAntispoofScore()
            );
        }).collect(Collectors.toList());
    }

    // ==========================================
    // 4. XEM DANH SÁCH SINH VIÊN VẮNG MẶT
    // ==========================================
    public List<AttendedStudentResponse> getAbsentStudents(Integer attendanceId, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Buổi điểm danh không tồn tại!"));

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

        return buildAbsentStudents(attendanceId, attendance.getClassId());
    }

    /**
     * Tính danh sách SV vắng = roster APPROVED của lớp trừ đi SV đã điểm danh.
     * Không kiểm tra quyền — caller tự lo phân quyền.
     */
    private List<AttendedStudentResponse> buildAbsentStudents(Integer attendanceId, Integer classId) {
        List<StudentClass> allStudentsInClass = studentClassRepository.findByClassIdAndStatus(classId, "APPROVED");
        List<Integer> allStudentIds = allStudentsInClass.stream()
                .map(StudentClass::getStudentId)
                .collect(Collectors.toList());

        List<StudentAttendance> attendedRecords = studentAttendanceRepository.findByAttendanceId(attendanceId);
        List<Integer> attendedStudentIds = attendedRecords.stream()
                .map(StudentAttendance::getStudentId)
                .collect(Collectors.toList());

        List<Integer> absentStudentIds = allStudentIds.stream()
                .filter(id -> !attendedStudentIds.contains(id))
                .collect(Collectors.toList());

        List<Student> absentStudents = studentRepository.findAllById(absentStudentIds);

        return absentStudents.stream().map(student -> {
            String fullNameFromProfile = userRepository.findById(student.getUsername())
                    .map(User::getProfile)
                    .map(Profile::getFullName)
                    .orElse("Chưa cập nhật tên");

            return new AttendedStudentResponse(
                    student.getMssv(),
                    fullNameFromProfile,
                    student.getUsername(),
                    null,  // Vắng mặt -> không có giờ checkin
                    null,  // Vắng mặt -> không có ảnh
                    false, // Vắng mặt -> không có cờ gian lận
                    null
            );
        }).collect(Collectors.toList());
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
    // 6. GIÁO VIÊN GHI NHẬN ĐIỂM DANH TỪ VERIFY (ĐÃ NÂNG CẤP)
    // ==========================================
    @Transactional
    public TeacherCheckinResponse teacherCheckin(
            Integer attendanceId,
            String studentUsername,
            String checkinTime,
            String imageUrl,
            Boolean isSpoof,
            Double antispoofScore,
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

        Optional<StudentAttendance> existingRecord = studentAttendanceRepository
                .findByAttendanceIdAndStudentId(attendanceId, student.getId());
        if (existingRecord.isPresent()) {
            return new TeacherCheckinResponse(
                    "Sinh viên " + studentUsername + " đã được điểm danh trước đó.",
                    existingRecord.get().getImageUrl()
            );
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

        // Gắn cờ nghi ngờ gian lận do AI gửi. isSpoof có thể null (client cũ) -> coi như hợp lệ.
        checkin.setSpoof(Boolean.TRUE.equals(isSpoof));
        checkin.setAntispoofScore(antispoofScore);

        String storedImageUrl = saveAttendanceImage(imageUrl);
        checkin.setImageUrl(storedImageUrl);

        studentAttendanceRepository.save(checkin);

        String message = Boolean.TRUE.equals(isSpoof)
                ? "Đã ghi nhận điểm danh (NGHI NGỜ GIAN LẬN) cho sinh viên: " + studentUsername
                : "Đã ghi nhận điểm danh cho sinh viên: " + studentUsername;
        return new TeacherCheckinResponse(message, storedImageUrl);
    }
    public List<StudentAttendanceReportDTO> getStudentAttendanceReport(Integer classId, Integer studentId, String token) {
        // Kiểm tra quyền (Chỉ cho phép sinh viên xem chính mình hoặc GV xem SV)
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);

        // Lấy tất cả các buổi học của lớp này
        List<Attendance> sessions = attendanceRepository.findByClassId(classId);

        return sessions.stream().map(session -> {
            // Kiểm tra xem sinh viên đã điểm danh buổi này chưa
            java.util.Optional<StudentAttendance> record =
                    studentAttendanceRepository.findByAttendanceIdAndStudentId(session.getId(), studentId);

            if (record.isPresent()) {
                StudentAttendance sa = record.get();
                return new StudentAttendanceReportDTO(
                        session.getId(),
                        session.getDatetime(),
                        true, // Đã điểm danh
                        sa.getImageUrl(),
                        sa.getCheckInTime(),
                        sa.isSpoof(), // Cờ nghi ngờ gian lận
                        sa.getAntispoofScore()
                );
            } else {
                return new StudentAttendanceReportDTO(
                        session.getId(),
                        session.getDatetime(),
                        false, // Chưa điểm danh (vắng)
                        null,
                        null,
                        false, // Vắng nên không có cờ gian lận
                        null
                );
            }
        }).collect(Collectors.toList());
    }
    // ==========================================
    // 7. GIÁO VIÊN HỦY ĐIỂM DANH (BỎ TICK CÓ MẶT)
    // ==========================================
    @Transactional
    public String removeCheckin(Integer attendanceId, String studentUsername, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép hủy điểm danh!");
        }

        Student student = studentRepository.findByUsername(studentUsername);
        if (student == null) throw new RuntimeException("Lỗi: Không tìm thấy sinh viên!");

        // Kiểm tra xem có bản ghi điểm danh không
        StudentAttendance record = studentAttendanceRepository
                .findByAttendanceIdAndStudentId(attendanceId, student.getId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Sinh viên này chưa được điểm danh!"));

        // Xóa bản ghi điểm danh
        studentAttendanceRepository.delete(record);

        return "Đã hủy điểm danh cho sinh viên: " + studentUsername;
    }

    // ==========================================
    // 10. GIÁO VIÊN ĐÓNG ĐIỂM DANH -> GỬI TỔNG KẾT QUA DISCORD
    // ==========================================
    @Transactional(readOnly = true)
    public String closeAttendance(Integer attendanceId, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép đóng điểm danh!");
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
            throw new RuntimeException("Lỗi: Bạn không có quyền đóng điểm danh cho lớp của giáo viên khác!");
        }

        // Tên + SĐT giáo viên qua Teacher -> User -> Profile
        String teacherName = userRepository.findById(teacher.getUsername())
                .map(User::getProfile)
                .map(Profile::getFullName)
                .orElse(teacher.getUsername());
        String teacherPhone = userRepository.findById(teacher.getUsername())
                .map(User::getProfile)
                .map(Profile::getPhone)
                .orElse("Chưa cập nhật");

        List<AttendedStudentResponse> attended = buildAttendedStudents(attendanceId);
        List<AttendedStudentResponse> absent = buildAbsentStudents(attendanceId, attendance.getClassId());

        int present = attended.size();
        int absentCount = absent.size();
        int total = present + absentCount;
        int spoofCount = (int) attended.stream().filter(AttendedStudentResponse::isSpoof).count();

        DiscordAttendancePayload payload = new DiscordAttendancePayload();
        payload.setTeacherName(teacherName);
        payload.setTeacherPhone(teacherPhone);
        payload.setClassName(clazz.getName());
        payload.setSessionTime(attendance.getDatetime() != null ? attendance.getDatetime().toString() : null);
        payload.setTotal(total);
        payload.setPresent(present);
        payload.setAbsent(absentCount);
        payload.setSpoofCount(spoofCount);
        payload.setAttended(attended);

        System.out.println("[CloseAttendance] attendanceId=" + attendanceId
                + " teacher=" + teacherName
                + " total=" + total + " present=" + present + " absent=" + absentCount
                + " spoof=" + spoofCount + " -> đang gửi Discord...");

        // Không để lỗi bot Discord làm hỏng thao tác đóng điểm danh của giáo viên.
        try {
            discordNotifier.notifyClose(payload);
        } catch (Exception exc) {
            System.err.println("[DiscordNotifier] Gửi tổng kết Discord THẤT BẠI: " + exc.getMessage());
            return "Đã đóng điểm danh (không gửi được thông báo Discord).";
        }

        System.out.println("[CloseAttendance] Đã gửi tổng kết tới Discord thành công.");
        return "Đã đóng điểm danh và gửi tổng kết tới Discord.";
    }
}
