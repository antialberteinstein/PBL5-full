package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.LoginRequest;
import com.tam.pbl5.dto.response.LoginResponse;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    // --- CHỨC NĂNG ĐĂNG NHẬP ---
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findById(request.getUsername())
                .orElseThrow(() -> new RuntimeException("Sai tên đăng nhập hoặc mật khẩu!"));

        if (!user.isEnabled()) {
            throw new RuntimeException("Tài khoản đã bị vô hiệu hóa! Vui lòng liên hệ quản trị viên.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Sai tên đăng nhập hoặc mật khẩu!");
        }

        Authority userAuth = authorityRepository.findById(user.getUsername())
                .orElseThrow(() -> new RuntimeException("Tài khoản chưa được phân quyền!"));
        String role = userAuth.getAuthority();

        String jwtToken = jwtService.generateToken(user.getUsername(), role);

        return LoginResponse.builder()
                .username(user.getUsername())
                .role(role)
                .token(jwtToken)
                .message("Đăng nhập thành công!")
                .build();
    }
}