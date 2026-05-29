package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.AdminCreateUserRequest;
import com.tam.pbl5.service.AdminService;
import com.tam.pbl5.service.ImportJobService;
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
    private final ImportJobService importJobService;

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

    /**
     * Khởi tạo job import (chạy nền) - trả về ngay ID + trạng thái ban đầu để FE poll.
     */
    @PostMapping("/import-excel")
    public ResponseEntity<?> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam("role") String role) {
        try {
            byte[] bytes = file.getBytes();
            return ResponseEntity.ok(importJobService.startImport(bytes, role));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /** Liệt kê các job import gần đây (để FE rehydrate sau khi reload/đăng nhập lại). */
    @GetMapping("/import-jobs")
    public ResponseEntity<?> listImportJobs() {
        try {
            return ResponseEntity.ok(importJobService.listJobs());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /** Trạng thái + tiến trình của một job (frontend poll endpoint này). */
    @GetMapping("/import-jobs/{id}")
    public ResponseEntity<?> getImportJob(@PathVariable String id) {
        try {
            return ResponseEntity.ok(importJobService.getJob(id));
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

    // Lấy thống kê hệ thống
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        try {
            return ResponseEntity.ok(adminService.getSystemStats());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Danh sách sinh viên (tab Quản lý sinh viên)
    @GetMapping("/students")
    public ResponseEntity<?> getAllStudents() {
        try {
            return ResponseEntity.ok(adminService.getAllStudents());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Danh sách giáo viên (tab Quản lý giáo viên)
    @GetMapping("/teachers")
    public ResponseEntity<?> getAllTeachers() {
        try {
            return ResponseEntity.ok(adminService.getAllTeachers());
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