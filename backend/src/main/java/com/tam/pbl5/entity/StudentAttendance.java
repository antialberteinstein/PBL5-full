package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "student_attendance")
@Data
public class StudentAttendance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "student_id")
    private Integer studentId;

    @Column(name = "attendance_id")
    private Integer attendanceId;

    @Column(name = "checkin_time")
    private LocalDateTime checkInTime;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    // true = AI nghi ngờ khuôn mặt là giả mạo (ảnh/video/mặt nạ) khi điểm danh.
    // Mặc định false để các bản ghi cũ / điểm danh tay không bị gắn cờ gian lận.
    @Column(name = "is_spoof", nullable = false)
    private boolean spoof = false;

    // Điểm liveness/anti-spoofing do AI trả về (0..1), null nếu không có.
    @Column(name = "antispoof_score")
    private Double antispoofScore;
}
