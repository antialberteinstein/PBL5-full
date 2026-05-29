package com.tam.pbl5.service;

import com.tam.pbl5.entity.Camera;
import com.tam.pbl5.repository.CameraRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Quản lý CCTV. Tạm thời mỗi camera tương ứng một AI server đang chạy.
 */
@Service
@RequiredArgsConstructor
public class CameraService {

    private final CameraRepository cameraRepository;

    public List<Camera> getAll() {
        return cameraRepository.findAll();
    }

    @Transactional
    public Camera create(Camera camera) {
        camera.setId(null); // đảm bảo tạo mới
        return cameraRepository.save(camera);
    }

    @Transactional
    public Camera update(Integer id, Camera input) {
        Camera camera = cameraRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy camera #" + id));
        if (input.getAiServerUrl() != null) camera.setAiServerUrl(input.getAiServerUrl());

        camera.setEnabled(input.isEnabled());
        return cameraRepository.save(camera);
    }

    @Transactional
    public void delete(Integer id) {
        if (!cameraRepository.existsById(id)) {
            throw new RuntimeException("Không tìm thấy camera #" + id);
        }
        cameraRepository.deleteById(id);
    }
}
