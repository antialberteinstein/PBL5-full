package com.tam.pbl5.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    // Khóa bí mật dùng chung cho cả việc tạo và giải mã Token
    private static final String SECRET_KEY = "DayLaMotMaBiMatCucKyDaiVaPhucTapChoDuAnPBL5CuaKhang123456";

    // --- 1. HÀM TẠO TOKEN (Đã có của bạn) ---
    public String generateToken(String username, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", role);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(username)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    // --- 2. CÁC HÀM GIẢI MÃ TOKEN (Mới thêm vào để bạn sử dụng) ---

    // Lấy Username (được lưu trong phần Subject)
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    // Lấy Quyền (được lưu trong Map Claims với khóa "role")
    public String extractRole(String token) {
        final Claims claims = extractAllClaims(token);
        return (String) claims.get("role");
    }

    // Kiểm tra Token đã hết hạn hay chưa
    public boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    // Hàm bổ trợ để lấy một thông tin cụ thể (Claim) bất kỳ
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    // "Mổ xẻ" Token để lấy toàn bộ dữ liệu bên trong (Payload)
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignInKey()) // Dùng chìa khóa để mở
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    // Hàm đọc khóa bí mật từ chuỗi BASE64
    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(SECRET_KEY);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}

