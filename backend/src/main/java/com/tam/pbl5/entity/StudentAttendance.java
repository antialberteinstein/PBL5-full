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
}
