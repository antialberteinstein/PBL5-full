package com.tam.pbl5.config;

import com.tam.pbl5.entity.Authority;
import com.tam.pbl5.entity.Profile;
import com.tam.pbl5.entity.User;
import com.tam.pbl5.repository.AuthorityRepository;
import com.tam.pbl5.repository.ProfileRepository;
import com.tam.pbl5.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final ProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Kiểm tra xem tài khoản 'admin' đã tồn tại trong DB chưa
        if (!userRepository.existsById("admin")) {

            // 1. Tạo Profile cho Admin
            Profile profile = new Profile();
            profile.setFullName("Quản trị viên tối cao");
            profile.setEmail("admin.pbl5@gmail.com");
            Profile savedProfile = profileRepository.save(profile);

            // 2. Tạo tài khoản đăng nhập (User)
            User user = new User();
            user.setUsername("admin");
            // Spring Boot sẽ tự động mã hóa mật khẩu "123456" thành chuỗi ngoằn ngoèo trước khi lưu
            user.setPassword(passwordEncoder.encode("123456"));
            user.setEnabled(true);
            user.setProfile(savedProfile);
            userRepository.save(user);

            // 3. Cấp quyền ROLE_ADMIN
            Authority authority = new Authority();
            authority.setUsername("admin");
            authority.setAuthority("ROLE_ADMIN");
            authorityRepository.save(authority);

            System.out.println("=========================================================");
            System.out.println("✅ ĐÃ TẠO TÀI KHOẢN ADMIN MẶC ĐỊNH CHO HỆ THỐNG!");
            System.out.println("👉 Username: admin");
            System.out.println("👉 Password: 123456");
            System.out.println("=========================================================");
        }
    }
}