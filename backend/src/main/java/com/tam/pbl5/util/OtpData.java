package com.tam.pbl5.util;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class OtpData {
    private String otpCode;
    private LocalDateTime expiryTime;
}