package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.LoginRequest;
import com.tam.pbl5.dto.request.RegisterRequest;
import com.tam.pbl5.dto.request.VerifyOtpRequest;
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
     * API Đăng ký tài khoản
     * Method: POST
     * URL: http://localhost:8080/api/auth/register
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        try {
            authService.registerAccount(request);
            return ResponseEntity.ok("Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP.");
        } catch (RuntimeException e) {
            // Nếu có lỗi (Tài khoản đã tồn tại, v.v.), trả về mã lỗi 400 kèm câu thông báo
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * API Xác thực mã OTP
     * Method: POST
     * URL: http://localhost:8080/api/auth/verify-otp
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody VerifyOtpRequest request) {
        try {
            String result = authService.verifyOtp(request.getUsername(), request.getOtpCode());
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            // Lỗi sai mã OTP, hết hạn, v.v.
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

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