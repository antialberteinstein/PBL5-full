package com.tam.pbl5.service;

import com.tam.pbl5.util.OtpData;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpCacheService {

    // Sử dụng ConcurrentHashMap để an toàn khi có nhiều người đăng ký cùng lúc
    private final Map<String, OtpData> otpCache = new ConcurrentHashMap<>();

    public void saveOtp(String username, String otpCode) {
        // Lưu OTP, thiết lập hết hạn sau 5 phút
        otpCache.put(username, new OtpData(otpCode, LocalDateTime.now().plusMinutes(5)));
    }

    public OtpData getOtp(String username) {
        return otpCache.get(username);
    }

    public void clearOtp(String username) {
        otpCache.remove(username);
    }
}