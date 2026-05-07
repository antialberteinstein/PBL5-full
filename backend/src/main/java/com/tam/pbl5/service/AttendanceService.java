package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.AttendanceCreateRequest;
import com.tam.pbl5.dto.response.AttendedStudentResponse; // ✨ ĐÃ THÊM IMPORT NÀY
import com.tam.pbl5.dto.response.TeacherCheckinResponse;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.List;
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
    private final JwtService jwtService;
    private final UserRepository userRepository;

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

        Attendance attendance = new Attendance();
        attendance.setClassId(clazz.getId());
        attendance.setDatetime(request.getDatetime() != null ? request.getDatetime() : LocalDateTime.now());

        return attendanceRepository.save(attendance);
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

        // 2. Lấy danh sách bản ghi điểm danh
        List<StudentAttendance> attendedRecords = studentAttendanceRepository.findByAttendanceId(attendanceId);

        // 3. ✨ CÁCH FIX LỖI: Sử dụng Optional Map để lấy dữ liệu từ nhiều bảng
        return attendedRecords.stream().map(record -> {
            // Tìm sinh viên
            Student student = studentRepository.findById(record.getStudentId())
                    .orElse(new Student());

            // Thay vì dùng ifPresent và gán lại biến (gây lỗi), ta dùng chuỗi map()
            // Nó sẽ đi từ: User -> Profile -> FullName. Nếu bất kỳ chỗ nào null, nó lấy "Chưa cập nhật"
            String fullNameFromProfile = userRepository.findById(student.getUsername())
                    .map(User::getProfile)
                    .map(Profile::getFullName)
                    .orElse("Chưa cập nhật tên");

            return new AttendedStudentResponse(
                    student.getMssv(),
                    fullNameFromProfile,
                    student.getUsername(),
                    record.getCheckInTime() != null ? record.getCheckInTime().toString() : null,
                    record.getImageUrl() // Link ảnh chụp từ AI hoặc null nếu điểm danh tay
            );
        }).collect(Collectors.toList());
    }

    // ==========================================
    // 4. XEM DANH SÁCH SINH VIÊN VẮNG MẶT
    // ==========================================
    public List<Student> getAbsentStudents(Integer attendanceId, String token) {
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

        List<StudentClass> allStudentsInClass = studentClassRepository.findByClassIdAndStatus(attendance.getClassId(), "APPROVED");
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

        return studentRepository.findAllById(absentStudentIds);
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

        if (studentAttendanceRepository.existsByAttendanceIdAndStudentId(attendanceId, student.getId())) {
            return new TeacherCheckinResponse(
                    "Sinh viên " + studentUsername + " đã được điểm danh trước đó.",
                    null
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

        String storedImageUrl = saveAttendanceImage(imageUrl);
        checkin.setImageUrl(storedImageUrl);

        studentAttendanceRepository.save(checkin);

        return new TeacherCheckinResponse(
                "Đã ghi nhận điểm danh cho sinh viên: " + studentUsername,
                storedImageUrl
        );
    }
}
