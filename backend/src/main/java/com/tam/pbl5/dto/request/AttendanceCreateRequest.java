package com.tam.pbl5.dto.request;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AttendanceCreateRequest {
    private Integer classId;
    private LocalDateTime datetime; // Đổi tên và kiểu dữ liệu ở đây
}