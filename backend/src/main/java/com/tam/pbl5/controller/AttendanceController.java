package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.AttendanceCreateRequest;
import com.tam.pbl5.dto.request.StudentCheckinRequest;
import com.tam.pbl5.dto.request.TeacherCheckinRequest;
import com.tam.pbl5.entity.Attendance;
import com.tam.pbl5.entity.Student;
import com.tam.pbl5.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attendance") // Đường dẫn gốc cho module điểm danh
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    // ==========================================
    // API GIÁO VIÊN TẠO BUỔI ĐIỂM DANH MỚI
    // ==========================================
    @PostMapping("/create")
    public ResponseEntity<?> createAttendanceSession(
            @RequestBody AttendanceCreateRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            // Sửa lại thành Attendance thay vì String
            Attendance newAttendance = attendanceService.createAttendanceSession(request, token);

            // Trả về thẳng cái object mới tạo cho React (React sẽ đọc được newAttendance.id)
            return ResponseEntity.ok(newAttendance);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 1B. API LẤY DANH SÁCH BUỔI ĐIỂM DANH THEO LỚP
    // ==========================================
    // Cách gọi: GET http://localhost:8080/api/attendance/{classId}
    @GetMapping("/{classId}")
    public ResponseEntity<?> getAttendanceByClass(
            @PathVariable Integer classId,
            @RequestHeader("Authorization") String token) {
        try {
            List<Attendance> attendances = attendanceService.getAttendanceByClass(classId, token);
            return ResponseEntity.ok(attendances);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 2. API Sinh viên tự điểm danh
    // ==========================================
    // Cách gọi: POST http://localhost:8080/api/attendance/checkin
    @PostMapping("/checkin")
    public ResponseEntity<?> studentCheckin(
            @RequestParam Integer attendanceId,
            @RequestParam String studentUsername,
            @RequestHeader(value = "x-api-key", required = false) String apiKey) {

        // 1. Mật khẩu bí mật để bảo vệ API (Chỉ AI mới biết mã này để gửi vào Header)
        String SECRET_AI_KEY = "PBL5_AI_Secret_Key_123456";

        if (apiKey == null || !apiKey.equals(SECRET_AI_KEY)) {
            return ResponseEntity.status(401).body("Lỗi: Sai API Key! Bạn không có quyền điểm danh.");
        }

        try {
            // 2. Gọi xuống hàm duy nhất trong Service của Khang
            String message = attendanceService.studentCheckin(attendanceId, studentUsername);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 3. API Xem danh sách sinh viên đã điểm danh (Có mặt)
    // ==========================================
    // Cách gọi: GET http://localhost:8080/api/attendance/1/attended-students
    @GetMapping("/{attendanceId}/attended-students")
    public ResponseEntity<?> getAttendedStudents(
            @PathVariable Integer attendanceId,
            @RequestHeader("Authorization") String token) {
        try {
            List<Student> students = attendanceService.getAttendedStudents(attendanceId, token);
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 4. API Xem danh sách sinh viên vắng mặt
    // ==========================================
    // Cách gọi: GET http://localhost:8080/api/attendance/1/absent-students
    @GetMapping("/{attendanceId}/absent-students")
    public ResponseEntity<?> getAbsentStudents(
            @PathVariable Integer attendanceId,
            @RequestHeader("Authorization") String token) {
        try {
            List<Student> students = attendanceService.getAbsentStudents(attendanceId, token);
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 5. API ĐÁNH DẤU TẤT CẢ SINH VIÊN CÓ MẶT
    // ==========================================
    // Cách gọi: POST http://localhost:8080/api/attendance/{attendanceId}/mark-all-present
    @PostMapping("/{attendanceId}/mark-all-present")
    public ResponseEntity<?> markAllPresent(
            @PathVariable Integer attendanceId,
            @RequestHeader("Authorization") String token) {
        try {
            String message = attendanceService.markAllPresent(attendanceId, token);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 6. API GIÁO VIÊN GHI NHẬN ĐIỂM DANH TỪ VERIFY
    // ==========================================
    // Cách gọi: POST http://localhost:8080/api/attendance/{attendanceId}/teacher-checkin
    @PostMapping("/{attendanceId}/teacher-checkin")
    public ResponseEntity<?> teacherCheckin(
            @PathVariable Integer attendanceId,
            @RequestBody TeacherCheckinRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            String message = attendanceService.teacherCheckin(
                    attendanceId,
                    request.getStudentUsername(),
                    request.getCheckinTime(),
                    token
            );
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}