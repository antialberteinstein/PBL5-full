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
    private boolean spoof; // true = AI nghi ngờ gian lận (khuôn mặt giả mạo) khi điểm danh
    private Double antispoofScore; // Điểm anti-spoofing kèm theo, có thể null
}