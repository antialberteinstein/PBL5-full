package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.StudentJoinRequest;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.service.StudentClassService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student-class") // Đường dẫn gốc cho các thao tác của sinh viên với lớp học
@RequiredArgsConstructor
public class StudentClassController {

    private final StudentClassService studentClassService;

    // ==========================================
    // 1. API Sinh viên gửi yêu cầu tham gia lớp
    // ==========================================
    // Cách gọi: POST http://localhost:8080/api/student-class/join
    @PostMapping("/join")
    public ResponseEntity<?> studentJoinClass(
            @RequestBody StudentJoinRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            String message = studentClassService.studentJoinClass(request, token);
            return ResponseEntity.ok(message); // Trả về câu thông báo thành công hoặc chờ duyệt
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 2. API Sinh viên xem các lớp đã tham gia (APPROVED)
    // ==========================================
    // Cách gọi: GET http://localhost:8080/api/student-class/my-joined-classes
    @GetMapping("/my-joined-classes")
    public ResponseEntity<?> getMyJoinedClasses(
            @RequestHeader("Authorization") String token) {
        try {
            List<Clazz> classes = studentClassService.getMyJoinedClasses(token);
            return ResponseEntity.ok(classes);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 3. API Cập nhật trạng thái đăng ký khuôn mặt
    // ==========================================
    // Cách gọi: PUT http://localhost:8080/api/student-class/face-registered?registered=true
    @PutMapping("/face-registered")
    public ResponseEntity<?> updateFaceRegistered(
            @RequestParam(defaultValue = "true") boolean registered,
            @RequestHeader("Authorization") String token) {
        try {
            String message = studentClassService.updateFaceRegistered(token, registered);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 4. API Lấy thông tin sinh viên hiện tại
    // ==========================================
    // Cách gọi: GET http://localhost:8080/api/student-class/me
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentStudent(@RequestHeader("Authorization") String token) {
        try {
            return ResponseEntity.ok(studentClassService.getCurrentStudent(token));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}