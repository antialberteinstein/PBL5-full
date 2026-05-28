package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "teacher")
@Data
public class Teacher {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(length = 50)
    private String username;

    // ✨ ĐÃ SỬA: Xóa nullable = false để cho phép null, vẫn giữ lại unique = true nếu muốn tránh trùng lặp
    @Column(name = "msgv", unique = true)
    private String msgv;
}