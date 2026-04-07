package com.tam.pbl5.dto.request;

import lombok.Data;

@Data
public class TeacherAddStudentRequest {
    private Integer classId;
    private String studentUsername;
}