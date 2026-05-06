package com.tam.pbl5.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AttendedStudentResponse {
    private String mssv;
    private String fullName;
    private String username;
    private String checkinTime;
    private String imageUrl; // ✨ Chứa link ảnh để React in ra bảng
}