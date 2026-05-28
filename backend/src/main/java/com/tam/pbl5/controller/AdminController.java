package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.AdminCreateUserRequest;
import com.tam.pbl5.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // ==========================================
    // API CŨ: TẠO VÀ IMPORT NGƯỜI DÙNG
    // ==========================================
    @PostMapping("/create-user")
    public ResponseEntity<?> createUser(@RequestBody AdminCreateUserRequest request) {
        try {
            String message = adminService.adminCreateUser(request);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/import-excel")
    public ResponseEntity<?> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam("role") String role) { // Nhận role từ FormData
        try {
            String result = adminService.importUsersFromExcel(file, role);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // ✨ CÁC API MỚI: QUẢN LÝ LỚP HỌC
    // ==========================================

    // Lấy danh sách toàn bộ lớp học
    @GetMapping("/classes")
    public ResponseEntity<?> getAllClasses() {
        try {
            return ResponseEntity.ok(adminService.getAllClasses());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Xem danh sách sinh viên trong 1 lớp
    @GetMapping("/classes/{classId}/students")
    public ResponseEntity<?> getStudentsInClass(@PathVariable Integer classId) {
        try {
            return ResponseEntity.ok(adminService.getStudentsInClass(classId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Xóa một lớp học
    @DeleteMapping("/classes/{classId}")
    public ResponseEntity<?> deleteClass(@PathVariable Integer classId) {
        try {
            return ResponseEntity.ok(adminService.deleteClass(classId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // ✨ CÁC API MỚI: QUẢN LÝ TÀI KHOẢN (USER)
    // ==========================================

    // Xem danh sách toàn bộ tài khoản
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        try {
            return ResponseEntity.ok(adminService.getAllUsers());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Đặt lại mật khẩu (Nhận JSON Body: {"newPassword": "..."})
    @PutMapping("/users/{username}/reset-password")
    public ResponseEntity<?> resetPassword(
            @PathVariable String username,
            @RequestBody Map<String, String> payload) {
        try {
            String newPassword = payload.get("newPassword");
            if (newPassword == null || newPassword.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Lỗi: Mật khẩu mới không được để trống!");
            }
            return ResponseEntity.ok(adminService.resetUserPassword(username, newPassword));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Xóa một tài khoản khỏi hệ thống
    @DeleteMapping("/users/{username}")
    public ResponseEntity<?> deleteUser(@PathVariable String username) {
        try {
            return ResponseEntity.ok(adminService.deleteUser(username));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}