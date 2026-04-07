package com.tam.pbl5.config;

import com.tam.pbl5.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Component // Đánh dấu đây là một Bean để Spring quản lý
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Kiểm tra xem khách có mang thẻ (Token) đến không
        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String username;

        // Nếu không có thẻ, hoặc thẻ không bắt đầu bằng "Bearer ", cho đi tiếp (lát nữa bảo vệ tự đuổi ra sau)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Cắt bỏ chữ "Bearer " để lấy đúng mã thẻ
        jwt = authHeader.substring(7);

        try {
            // 3. Dùng phần mềm JwtService của Khang để đọc tên trong thẻ
            username = jwtService.extractUsername(jwt);

            // 4. Nếu đọc được tên và người này chưa được cấp quyền qua cổng
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                // 5. Đọc xem người này làm nghề gì (ROLE_TEACHER hay ROLE_STUDENT)
                String role = jwtService.extractRole(jwt);

                // Đóng gói Role lại cho anh bảo vệ hiểu
                List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority(role));

                // 6. Cấp thẻ thông hành VIP (UsernamePasswordAuthenticationToken)
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        username,
                        null,
                        authorities
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // 7. Nhét thẻ thông hành vào túi áo anh bảo vệ (SecurityContext) để anh ấy cho qua
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        } catch (Exception e) {
            // Nếu thẻ giả, thẻ hết hạn... thì máy quét báo lỗi
            System.out.println("Lỗi khi quét Token: " + e.getMessage());
        }

        // 8. Xong xuôi, mời đi tiếp vào API bên trong
        filterChain.doFilter(request, response);
    }
}