package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.AttendanceCreateRequest;
import com.tam.pbl5.dto.request.TeacherCheckinRequest;
import com.tam.pbl5.dto.response.AttendedStudentResponse;
import com.tam.pbl5.dto.response.StudentAttendanceReportDTO; // Import DTO báo cáo
import com.tam.pbl5.dto.response.TeacherCheckinResponse;
import com.tam.pbl5.entity.Attendance;
import com.tam.pbl5.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attendance")
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
            Attendance newAttendance = attendanceService.createAttendanceSession(request, token);
            return ResponseEntity.ok(newAttendance);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 1B. API LẤY DANH SÁCH BUỔI ĐIỂM DANH THEO LỚP
    // ==========================================
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
    // 2. API Sinh viên / AI tự điểm danh
    // ==========================================
    @PostMapping("/checkin")
    public ResponseEntity<?> studentCheckin(
            @RequestParam Integer attendanceId,
            @RequestParam String studentUsername,
            @RequestParam(required = false) String imageUrl,
            @RequestHeader(value = "x-api-key", required = false) String apiKey) {

        String SECRET_AI_KEY = "PBL5_AI_Secret_Key_123456";

        if (apiKey == null || !apiKey.equals(SECRET_AI_KEY)) {
            return ResponseEntity.status(401).body("Lỗi: Sai API Key! Bạn không có quyền điểm danh.");
        }

        try {
            String message = attendanceService.studentCheckin(attendanceId, studentUsername, imageUrl);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 3. API Xem danh sách sinh viên đã điểm danh (Có mặt)
    // ==========================================
    @GetMapping("/{attendanceId}/attended-students")
    public ResponseEntity<?> getAttendedStudents(
            @PathVariable Integer attendanceId,
            @RequestHeader("Authorization") String token) {
        try {
            List<AttendedStudentResponse> response = attendanceService.getAttendedStudents(attendanceId, token);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 4. API Xem danh sách sinh viên vắng mặt
    // ==========================================
    @GetMapping("/{attendanceId}/absent-students")
    public ResponseEntity<?> getAbsentStudents(
            @PathVariable Integer attendanceId,
            @RequestHeader("Authorization") String token) {
        try {
            // ✨ ĐÃ SỬA: Đổi List<Student> thành List<AttendedStudentResponse>
            List<AttendedStudentResponse> students = attendanceService.getAbsentStudents(attendanceId, token);
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 5. API ĐÁNH DẤU TẤT CẢ SINH VIÊN CÓ MẶT
    // ==========================================
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
    @PostMapping("/{attendanceId}/teacher-checkin")
    public ResponseEntity<?> teacherCheckin(
            @PathVariable Integer attendanceId,
            @RequestBody TeacherCheckinRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            TeacherCheckinResponse response = attendanceService.teacherCheckin(
                    attendanceId,
                    request.getStudentUsername(),
                    request.getCheckinTime(),
                    request.getImageUrl(),
                    request.getIsSpoof(),
                    request.getAntispoofScore(),
                    token
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 7. API LẤY KẾT QUẢ ĐIỂM DANH CÁ NHÂN
    // ==========================================
    @GetMapping("/report/{classId}")
    public ResponseEntity<?> getStudentAttendanceReport(
            @PathVariable Integer classId,
            @RequestParam Integer studentId,
            @RequestHeader("Authorization") String token) {
        try {
            List<StudentAttendanceReportDTO> report = attendanceService.getStudentAttendanceReport(classId, studentId, token);
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 9. API GIÁO VIÊN RESET ĐIỂM DANH 1 BUỔI (TEST/DEMO)
    // ==========================================
    @PostMapping("/{attendanceId}/reset")
    public ResponseEntity<?> resetAttendance(
            @PathVariable Integer attendanceId,
            @RequestHeader("Authorization") String token) {
        try {
            String message = attendanceService.resetAttendance(attendanceId, token);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 8. API GIÁO VIÊN HỦY ĐIỂM DANH (BỎ TICK CÓ MẶT)
    // ==========================================
    @DeleteMapping("/{attendanceId}/remove-checkin/{studentUsername}")
    public ResponseEntity<?> removeCheckin(
            @PathVariable Integer attendanceId,
            @PathVariable String studentUsername,
            @RequestHeader("Authorization") String token) {
        try {
            // Gọi sang service để xóa bản ghi điểm danh
            String message = attendanceService.removeCheckin(attendanceId, studentUsername, token);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 10. GIÁO VIÊN ĐÓNG ĐIỂM DANH -> GỬI TỔNG KẾT QUA DISCORD
    // ==========================================
    @PostMapping("/{attendanceId}/close")
    public ResponseEntity<?> closeAttendance(
            @PathVariable Integer attendanceId,
            @RequestHeader("Authorization") String token) {
        try {
            String message = attendanceService.closeAttendance(attendanceId, token);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}