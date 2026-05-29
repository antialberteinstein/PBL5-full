package com.tam.pbl5.websocket;

import com.tam.pbl5.service.JwtService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Proxies /ws/register_stream from frontend to the AI server.
 * Forwards student_id and reregister query params; strips the auth token.
 */
@Slf4j
@Component
public class RegisterStreamProxyHandler extends AiProxyWebSocketHandler {

    @Value("${ai.server.url:http://127.0.0.1:8000}")
    private String aiServerUrl;

    public RegisterStreamProxyHandler(JwtService jwtService) {
        super(jwtService);
    }

    @Override
    protected String resolveAiTargetUrl(WebSocketSession session) {
        String wsBase = toWs(aiServerUrl) + "/ws/register_stream";
        String query = session.getUri().getQuery();
        if (query == null || query.isBlank()) {
            return wsBase;
        }
        String forwardedQuery = Arrays.stream(query.split("&"))
                .filter(p -> !p.startsWith("token="))
                .collect(Collectors.joining("&"));
        return forwardedQuery.isBlank() ? wsBase : wsBase + "?" + forwardedQuery;
    }

    private static String toWs(String url) {
        return url.replaceFirst("^http://", "ws://")
                  .replaceFirst("^https://", "wss://")
                  .replaceAll("/$", "");
    }
}
