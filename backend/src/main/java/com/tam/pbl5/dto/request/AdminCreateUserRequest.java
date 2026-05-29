package com.tam.pbl5.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminCreateUserRequest {

    /**
     * Vai trò của người dùng mới: "TEACHER" hoặc "STUDENT".
     */
    private String role;

    // Họ và tên đầy đủ (bắt buộc cho cả hai vai trò)
    private String fullName;

    // ===== Sinh viên =====
    // MSSV: dùng làm username; mật khẩu mặc định = DDMMYYYY của ngày sinh
    private String mssv;
    private String lopSinhHoat;   // Lớp sinh hoạt
    private LocalDate birth;      // Ngày sinh

    // ===== Giáo viên =====
    // Username & password = họ tên không dấu viết liền (sinh tự động từ fullName)
    private String phone;         // SĐT
}