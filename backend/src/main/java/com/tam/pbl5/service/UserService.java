package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.ProfileUpdateRequest;
import com.tam.pbl5.entity.*;
import com.tam.pbl5.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

/**
 * Các thao tác tự phục vụ của người dùng đang đăng nhập (sinh viên / giáo viên):
 * xem hồ sơ, sửa hồ sơ, đổi mật khẩu.
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final ProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new RuntimeException("Chưa đăng nhập!");
        }
        return auth.getName();
    }

    private User currentUser() {
        return userRepository.findById(currentUsername())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));
    }

    /** Thông tin hồ sơ của chính người dùng đang đăng nhập. */
    public Map<String, Object> getMe() {
        User user = currentUser();
        Map<String, Object> map = new HashMap<>();
        map.put("username", user.getUsername());

        String role = authorityRepository.findById(user.getUsername())
                .map(Authority::getAuthority).orElse(null);
        // Trả về dạng ngắn (STUDENT/TEACHER/ADMIN) cho tiện hiển thị
        map.put("role", role == null ? null : role.replace("ROLE_", ""));

        Profile profile = user.getProfile();
        if (profile != null) {
            map.put("profileId", profile.getId());
            map.put("fullName", profile.getFullName());
            map.put("birth", profile.getBirth());
            map.put("avatarPath", profile.getAvatarPath());
            map.put("phone", profile.getPhone());
        }

        Student student = studentRepository.findByUsername(user.getUsername());
        if (student != null) {
            map.put("mssv", student.getMssv());
            map.put("lopSinhHoat", student.getLopSinhHoat());
            map.put("faceRegistered", student.isFaceRegistered());
        }
        Teacher teacher = teacherRepository.findByUsername(user.getUsername());
        if (teacher != null) {
            map.put("msgv", teacher.getMsgv());
        }
        return map;
    }

    /** Đổi mật khẩu của chính mình (kiểm tra mật khẩu cũ). */
    @Transactional
    public void changePassword(String oldPassword, String newPassword) {
        if (newPassword == null || newPassword.trim().length() < 4) {
            throw new RuntimeException("Mật khẩu mới phải có ít nhất 4 ký tự!");
        }
        User user = currentUser();
        if (oldPassword == null || !passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("Mật khẩu hiện tại không chính xác!");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /** Cập nhật hồ sơ cá nhân của chính mình. */
    @Transactional
    public Map<String, Object> updateMyProfile(ProfileUpdateRequest request) {
        User user = currentUser();
        Profile profile = user.getProfile();
        if (profile == null) {
            throw new RuntimeException("Tài khoản chưa có hồ sơ!");
        }
        if (request.getFullName() != null) {
            profile.setFullName(request.getFullName());
        }
        if (request.getBirth() != null) {
            profile.setBirth(request.getBirth());
        }
        if (request.getPhone() != null) {
            profile.setPhone(request.getPhone());
        }
        profileRepository.save(profile);
        return getMe();
    }
}
