package com.tam.pbl5.dto.request;

import com.tam.pbl5.dto.response.AttendedStudentResponse;
import lombok.Data;

import java.util.List;

/**
 * Payload backend gửi sang bot Discord (POST /notify) khi giáo viên đóng điểm danh.
 * imageUrl trong attended giữ dạng tương đối "/uploads/..."; bot tự ghép BACKEND_BASE_URL.
 */
@Data
public class DiscordAttendancePayload {
    private String teacherName;
    private String teacherPhone;
    private String className;
    private String sessionTime;
    private int total;
    private int present;
    private int absent;
    private int spoofCount;
    private List<AttendedStudentResponse> attended;
}
