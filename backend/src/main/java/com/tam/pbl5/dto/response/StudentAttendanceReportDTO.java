package com.tam.pbl5.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class StudentAttendanceReportDTO {
    private Integer attendanceId;
    private LocalDateTime sessionDatetime;
    private boolean isPresent;
    private String imageUrl; // Link ảnh nếu có mặt
    private LocalDateTime checkInTime; // Giờ điểm danh
    private boolean spoof; // true = buổi này bị AI nghi ngờ gian lận (khuôn mặt giả mạo)
    private Double antispoofScore; // Điểm anti-spoofing kèm theo, có thể null
}