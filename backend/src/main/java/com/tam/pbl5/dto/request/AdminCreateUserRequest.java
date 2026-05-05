package com.tam.pbl5.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminCreateUserRequest {

    private String username;    // Tên đăng nhập
    private String password;    // Mật khẩu (Admin đặt mặc định, ví dụ: 123456)
    private String email;       // Email của người dùng
    private String fullName;    // Họ và tên đầy đủ

    /**
     * Vai trò của người dùng mới.
     * Giá trị truyền lên sẽ là: "TEACHER" hoặc "STUDENT"
     */
    private String role;

    /**
     * Mã định danh dùng chung (Mã số):
     * - Nếu role = "STUDENT" -> Hệ thống tự hiểu đây là MSSV.
     * - Nếu role = "TEACHER" -> Hệ thống tự hiểu đây là MSGV.
     */
    private String code;
}