package com.tam.pbl5.dto.request;

import lombok.Data;
import java.time.LocalDate;

@Data
public class ProfileUpdateRequest {
    private LocalDate birth;
    private String fullName;
    private String phone;
}