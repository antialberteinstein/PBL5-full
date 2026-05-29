package com.tam.pbl5.controller;

import com.tam.pbl5.entity.Camera;
import com.tam.pbl5.service.CameraService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Quản lý CCTV (chỉ admin). Nằm dưới /api/admin nên được bảo vệ bởi ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/admin/cameras")
@RequiredArgsConstructor
public class CameraController {

    private final CameraService cameraService;

    @GetMapping
    public ResponseEntity<?> getAll() {
        try {
            return ResponseEntity.ok(cameraService.getAll());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Camera camera) {
        try {
            return ResponseEntity.ok(cameraService.create(camera));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Camera camera) {
        try {
            return ResponseEntity.ok(cameraService.update(id, camera));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        try {
            cameraService.delete(id);
            return ResponseEntity.ok("Đã xóa camera #" + id);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
