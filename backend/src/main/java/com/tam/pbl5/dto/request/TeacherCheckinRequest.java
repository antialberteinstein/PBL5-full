package com.tam.pbl5.dto.request;

import lombok.Data;

@Data
public class TeacherCheckinRequest {
    private String studentUsername;
    private String checkinTime;
}
