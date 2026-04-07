package com.tam.pbl5.config;

import lombok.RequiredArgsConstructor; // Thêm import này
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter; // Thêm import này

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor // BẮT BUỘC phải có annotation này để Spring tự động tiêm JwtAuthenticationFilter vào
public class SecurityConfig {

    // 1. GỌI MÁY QUÉT TOKEN VÀO ĐÂY
    private final JwtAuthenticationFilter jwtAuthFilter;

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Báo cho Spring Security biết là hãy áp dụng luật CORS từ file CorsConfig
                .cors(Customizer.withDefaults())

                .csrf(AbstractHttpConfigurer::disable) // Phải tắt cái này thì Postman mới gửi được lệnh POST
                .authorizeHttpRequests(auth -> auth
                        // Mở cửa cho tất cả các request thăm dò (OPTIONS) từ React bay qua
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Mở cửa tự do (không cần token) cho tất cả các API nằm trong /api/auth/
                        .requestMatchers("/api/auth/**").permitAll()

                        // Còn lại tất cả các API khác (sau này bạn viết) đều phải có Token mới vào được
                        .anyRequest().authenticated()
                )
                // 2. QUAN TRỌNG NHẤT: Lắp máy quét Token vào trước cổng bảo vệ
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}