package com.tam.pbl5.config;

import com.tam.pbl5.service.JwtService;
import com.tam.pbl5.websocket.RegisterStreamProxyHandler;
import com.tam.pbl5.websocket.VerifyStreamProxyHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.websocket.server.ServerContainer;
import org.springframework.boot.web.servlet.ServletContextInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final JwtService jwtService;
    private final RegisterStreamProxyHandler registerStreamProxy;
    private final VerifyStreamProxyHandler verifyStreamProxy;

    @Bean
    public ServletContextInitializer webSocketBufferCustomizer() {
        // ServletServerContainerFactoryBean fails in test contexts (no real Tomcat).
        // ServletContextInitializer runs after Tomcat initialises the WS container, so it's safe.
        return servletContext -> {
            Object attr = servletContext.getAttribute("jakarta.websocket.server.ServerContainer");
            if (attr instanceof ServerContainer serverContainer) {
                // Frames from FaceRegistration can exceed 8KB (224×224 JPEG). Set 1MB.
                serverContainer.setDefaultMaxBinaryMessageBufferSize(1024 * 1024);
                serverContainer.setDefaultMaxTextMessageBufferSize(64 * 1024);
                log.info("[WsConfig] WebSocket buffer set: binary=1MB text=64KB");
            }
        };
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(registerStreamProxy, "/ws/register_stream")
                .addInterceptors(jwtHandshakeInterceptor())
                .setAllowedOriginPatterns("*");

        registry.addHandler(verifyStreamProxy, "/ws/verify_stream_local")
                .addInterceptors(jwtHandshakeInterceptor())
                .setAllowedOriginPatterns("*");
    }

    private HandshakeInterceptor jwtHandshakeInterceptor() {
        return new HandshakeInterceptor() {
            @Override
            public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                    WebSocketHandler wsHandler, Map<String, Object> attributes) {
                String query = request.getURI().getQuery();
                if (query == null || query.isBlank()) {
                    log.warn("[WsAuth] Rejected: no query string");
                    return false;
                }
                Map<String, String> params = Arrays.stream(query.split("&"))
                        .filter(p -> p.contains("="))
                        .collect(Collectors.toMap(
                                p -> p.split("=", 2)[0],
                                p -> p.split("=", 2)[1],
                                (a, b) -> a
                        ));
                String token = params.get("token");
                if (token == null || token.isBlank()) {
                    log.warn("[WsAuth] Rejected: missing token");
                    return false;
                }
                try {
                    if (jwtService.isTokenExpired(token)) {
                        log.warn("[WsAuth] Rejected: token expired");
                        return false;
                    }
                } catch (Exception e) {
                    log.warn("[WsAuth] Rejected: invalid token - {}", e.getMessage());
                    return false;
                }
                return true;
            }

            @Override
            public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                    WebSocketHandler wsHandler, Exception exception) {}
        };
    }
}
