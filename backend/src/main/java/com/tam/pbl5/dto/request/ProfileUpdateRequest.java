package com.tam.pbl5.dto.request;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ProfileUpdateRequest {
    private LocalDateTime birth;
    private String fullName;
}