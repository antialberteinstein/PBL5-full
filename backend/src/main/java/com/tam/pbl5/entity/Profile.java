package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(name = "profile")
@Data
public class Profile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "avatar_path")
    private String avatarPath;

    // Ngày sinh (dùng cho sinh viên: nguồn sinh ra mật khẩu mặc định DDMMYYYY)
    private LocalDate birth;

    @Column(name = "full_name")
    private String fullName;

    // Số điện thoại (dùng cho giáo viên - cột SĐT trong file Excel)
    private String phone;
}