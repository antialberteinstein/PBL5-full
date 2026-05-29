package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.ProfileUpdateRequest;
import com.tam.pbl5.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // Hồ sơ của chính người dùng đang đăng nhập
    @GetMapping("/me")
    public ResponseEntity<?> getMe() {
        try {
            return ResponseEntity.ok(userService.getMe());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Đổi mật khẩu: { "oldPassword": "...", "newPassword": "..." }
    @PutMapping("/me/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> payload) {
        try {
            userService.changePassword(payload.get("oldPassword"), payload.get("newPassword"));
            return ResponseEntity.ok("Đổi mật khẩu thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Cập nhật hồ sơ cá nhân (fullName, birth, phone)
    @PutMapping("/me/profile")
    public ResponseEntity<?> updateMyProfile(@RequestBody ProfileUpdateRequest request) {
        try {
            return ResponseEntity.ok(userService.updateMyProfile(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
