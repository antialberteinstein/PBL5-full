package com.tam.pbl5.dto.request;

import lombok.Data;

@Data
public class TeacherCheckinRequest {
    private String studentUsername;
    private String checkinTime;
    private String imageUrl;
    // Cờ nghi ngờ gian lận do AI gửi: true nếu khuôn mặt bị đánh giá là giả mạo.
    private Boolean isSpoof;
    // Điểm anti-spoofing (0..1) kèm theo, có thể null.
    private Double antispoofScore;
}
