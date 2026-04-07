package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.ProfileUpdateRequest;
import com.tam.pbl5.entity.Profile;
import com.tam.pbl5.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final ProfileRepository profileRepository;

    @Transactional
    public Profile updatePartialProfile(Integer profileId, ProfileUpdateRequest request) {
        // 1. Tìm Profile cũ trong Database
        Profile existingProfile = profileRepository.findById(profileId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Không tìm thấy hồ sơ (Profile) này!"));

        // 2. Kiểm tra và cập nhật Tên
        if (request.getFullName() != null) {
            existingProfile.setFullName(request.getFullName());
        }

        // 3. Kiểm tra và cập nhật Ngày sinh
        if (request.getBirth() != null) {
            existingProfile.setBirth(request.getBirth());
        }

        // 4. Lưu thay đổi
        return profileRepository.save(existingProfile);
    }
}