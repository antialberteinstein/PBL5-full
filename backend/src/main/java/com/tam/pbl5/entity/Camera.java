package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

/**
 * Một bản ghi CCTV. Tạm thời mỗi camera tương ứng với một AI server đang chạy
 * (id = 1 trỏ về server AI mặc định). Luồng đăng ký khuôn mặt vẫn gọi AI server
 * trực tiếp và không phụ thuộc vào bảng này.
 */
@Entity
@Table(name = "camera")
@Data
public class Camera {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // URL gốc của AI server tương ứng (vd http://127.0.0.1:8000)
    @Column(name = "ai_server_url")
    private String aiServerUrl;

    private boolean enabled = true;

}
