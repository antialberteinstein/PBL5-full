package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "profile")
@Data
public class Profile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "avatar_path")
    private String avatarPath;

    private LocalDateTime birth;

    @Column(name = "full_name")
    private String fullName;

    // Thêm trường email để đồng bộ với cột trong database
    @Column(nullable = false)
    private String email;
}