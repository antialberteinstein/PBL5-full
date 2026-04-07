package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.ClassCreateRequest;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Student;
import com.tam.pbl5.service.ClazzService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classes") // Đường dẫn gốc cho các API liên quan đến lớp học
@RequiredArgsConstructor
public class ClazzController {

    private final ClazzService clazzService;

    // ==========================================
    // 1. API Tạo lớp học mới (Chỉ dành cho Giáo viên)
    // ==========================================
    // Cách gọi: POST http://localhost:8080/api/classes/create
    @PostMapping("/create")
    public ResponseEntity<?> createNewClass(
            @RequestBody ClassCreateRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            Clazz newClass = clazzService.createNewClass(request, token);
            return ResponseEntity.ok(newClass);
        } catch (Exception e) {
            // Trả về mã lỗi 400 Bad Request kèm theo câu thông báo lỗi từ Service
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 2. API Xem danh sách sinh viên chính thức của lớp
    // ==========================================
    // Cách gọi: GET http://localhost:8080/api/classes/1/students (Thay số 1 bằng ID lớp)
    @GetMapping("/{classId}/students")
    public ResponseEntity<?> getApprovedStudentsInClass(
            @PathVariable Integer classId,
            @RequestHeader("Authorization") String token) {
        try {
            List<Student> students = clazzService.getApprovedStudentsInClass(classId, token);
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}