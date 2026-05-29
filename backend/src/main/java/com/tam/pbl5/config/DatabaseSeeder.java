package com.tam.pbl5.config;

import com.tam.pbl5.entity.Authority;
import com.tam.pbl5.entity.Camera;
import com.tam.pbl5.entity.Profile;
import com.tam.pbl5.entity.User;
import com.tam.pbl5.repository.AuthorityRepository;
import com.tam.pbl5.repository.CameraRepository;
import com.tam.pbl5.repository.ProfileRepository;
import com.tam.pbl5.repository.RoomRepository;
import com.tam.pbl5.repository.UserRepository;
import com.tam.pbl5.entity.Room;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class    DatabaseSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final ProfileRepository profileRepository;
    private final CameraRepository cameraRepository;
    private final RoomRepository roomRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Kiểm tra xem tài khoản 'admin' đã tồn tại trong DB chưa
        if (!userRepository.existsById("admin")) {

            // 1. Tạo Profile cho Admin
            Profile profile = new Profile();
            profile.setFullName("Quản trị viên tối cao");
            Profile savedProfile = profileRepository.save(profile);

            // 2. Tạo tài khoản đăng nhập (User) - mật khẩu được mã hóa BCrypt
            User user = new User();
            user.setUsername("admin");
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

        // Seed phòng mặc định F101 và CCTV kết nối với AI Server
        if (cameraRepository.count() == 0 && !roomRepository.existsByName("F101")) {
            Camera camera = new Camera();
            camera.setAiServerUrl("http://127.0.0.1:8000");
            camera.setEnabled(true);
            camera = cameraRepository.save(camera);

            Room room = new Room();
            room.setName("F101");
            room.setCamera(camera);
            roomRepository.save(room);

            System.out.println("✅ ĐÃ TẠO PHÒNG MẶC ĐỊNH F101 & CCTV TƯƠNG ỨNG.");
        }
    }
}