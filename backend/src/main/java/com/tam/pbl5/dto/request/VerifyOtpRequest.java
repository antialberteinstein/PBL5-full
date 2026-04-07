package com.tam.pbl5.dto.request;

import lombok.Data;

@Data
public class VerifyOtpRequest {
    private String username;
    private String otpCode;
}