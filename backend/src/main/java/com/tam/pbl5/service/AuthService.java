package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.LoginRequest;
import com.tam.pbl5.dto.request.RegisterRequest;
import com.tam.pbl5.dto.response.LoginResponse;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import com.tam.pbl5.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final AuthorityRepository authorityRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    // Inject thêm 2 service mới
    private final OtpCacheService otpCacheService;
    private final JavaMailSender mailSender;

    // --- CHỨC NĂNG ĐĂNG KÝ (Tạo tài khoản & Gửi mã OTP) ---
    @Transactional
    public void registerAccount(RegisterRequest request) {
        if (userRepository.existsById(request.getUsername())) {
            throw new RuntimeException("Tài khoản đã tồn tại!");
        }

        Profile profile = new Profile();
        profile.setEmail(request.getEmail());
        profile = profileRepository.save(profile);

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        // QUAN TRỌNG: Khóa tài khoản, chờ xác thực
        user.setEnabled(false);
        user.setProfile(profile);
        userRepository.save(user);

        Authority authority = new Authority();
        authority.setUsername(user.getUsername());

        if ("TEACHER".equalsIgnoreCase(request.getRole())) {
            authority.setAuthority("ROLE_TEACHER");
            Teacher teacher = new Teacher();
            teacher.setUsername(user.getUsername());
            teacherRepository.save(teacher);
        } else {
            authority.setAuthority("ROLE_STUDENT");
            Student student = new Student();
            student.setUsername(user.getUsername());
            student.setFaceRegistered(false);
            studentRepository.save(student);
        }
        authorityRepository.save(authority);

        // 1. Tạo mã OTP 6 số ngẫu nhiên
        String otpCode = String.format("%06d", new Random().nextInt(999999));

        // 2. Lưu OTP vào RAM
        otpCacheService.saveOtp(user.getUsername(), otpCode);

        // 3. Gửi Email (Chạy bất đồng bộ thì tốt hơn, nhưng tạm thời cứ chạy đồng bộ)
        sendOtpEmail(request.getEmail(), otpCode);
    }

    // --- HÀM GỬI EMAIL ---
    private void sendOtpEmail(String email, String otpCode) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Mã xác nhận đăng ký tài khoản");
        message.setText("Chào bạn,\n\nMã xác nhận (OTP) của bạn là: " + otpCode + "\n\nMã này sẽ hết hạn trong 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.");
        mailSender.send(message);
    }

    // --- CHỨC NĂNG XÁC THỰC OTP ---
    @Transactional
    public String verifyOtp(String username, String inputOtp) {
        OtpData storedOtpData = otpCacheService.getOtp(username);

        if (storedOtpData == null) {
            throw new RuntimeException("Không tìm thấy mã OTP hoặc bạn chưa đăng ký!");
        }

        if (storedOtpData.getExpiryTime().isBefore(LocalDateTime.now())) {
            otpCacheService.clearOtp(username);
            throw new RuntimeException("Mã OTP đã hết hạn! Vui lòng yêu cầu gửi lại.");
        }

        if (!storedOtpData.getOtpCode().equals(inputOtp)) {
            throw new RuntimeException("Mã OTP không chính xác!");
        }

        // Kích hoạt User
        User user = userRepository.findById(username)
                .orElseThrow(() -> new RuntimeException("Tài khoản không tồn tại!"));
        user.setEnabled(true);
        userRepository.save(user);

        // Xóa OTP khỏi RAM
        otpCacheService.clearOtp(username);

        return "Xác thực thành công! Bạn có thể đăng nhập.";
    }

    // --- CHỨC NĂNG ĐĂNG NHẬP ---
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findById(request.getUsername())
                .orElseThrow(() -> new RuntimeException("Tài khoản không tồn tại!"));

        // Check xem user đã xác thực email chưa
        if (!user.isEnabled()) {
            throw new RuntimeException("Tài khoản chưa được xác thực! Vui lòng kiểm tra email.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Mật khẩu không chính xác!");
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