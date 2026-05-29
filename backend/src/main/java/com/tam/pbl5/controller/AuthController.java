package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.LoginRequest;
import com.tam.pbl5.dto.response.LoginResponse;
import com.tam.pbl5.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * API Đăng nhập
     * Method: POST
     * URL: http://localhost:8080/api/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            LoginResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            // Lỗi sai mật khẩu, tài khoản chưa xác thực, v.v.
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}