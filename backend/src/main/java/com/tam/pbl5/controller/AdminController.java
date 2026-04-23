package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.AdminCreateUserRequest;
import com.tam.pbl5.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
// DÒNG IMPORT ĐƯỢC THÊM VÀO ĐỂ SỬA LỖI MULTIPARTFILE
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // API: POST /api/admin/create-user
    @PostMapping("/create-user")
    public ResponseEntity<?> createUser(@RequestBody AdminCreateUserRequest request) {
        try {
            // Đẩy dữ liệu từ Controller xuống Service xử lý
            String message = adminService.adminCreateUser(request);
            return ResponseEntity.ok(message); // Trả về thông báo thành công (HTTP 200)
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage()); // Trả về lỗi nếu trùng username/email (HTTP 400)
        }
    }

    // API: POST /api/admin/import-excel
    @PostMapping("/import-excel")
    public ResponseEntity<?> importExcel(@RequestParam("file") MultipartFile file) {
        try {
            String result = adminService.importUsersFromExcel(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}