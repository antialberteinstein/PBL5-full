package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.ProfileUpdateRequest;
import com.tam.pbl5.entity.Profile;
import com.tam.pbl5.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profiles")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    // API Cập nhật thông tin profile (chỉ cập nhật những trường được gửi lên)
    // Cách gọi: PATCH http://localhost:8080/api/profiles/1 (Thay số 1 bằng ID của profile)
    @PatchMapping("/{id}")
    public ResponseEntity<?> updateProfile(
            @PathVariable Integer id,
            @RequestBody ProfileUpdateRequest request) {
        try {
            Profile updatedProfile = profileService.updatePartialProfile(id, request);
            return ResponseEntity.ok(updatedProfile);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}