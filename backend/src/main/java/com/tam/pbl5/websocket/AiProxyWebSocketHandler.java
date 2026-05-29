package com.tam.pbl5.websocket;

import com.tam.pbl5.service.JwtService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Base WebSocket proxy: relays messages bidirectionally between a frontend
 * WebSocket session and an upstream AI server WebSocket.
 */
@Slf4j
public abstract class AiProxyWebSocketHandler extends AbstractWebSocketHandler {

    protected final JwtService jwtService;
    private final Map<String, WebSocket> aiSessions = new ConcurrentHashMap<>();

    // Per-session accumulators for incoming partial messages from frontend
    private final Map<String, ByteArrayOutputStream> inBinaryBufs = new ConcurrentHashMap<>();
    private final Map<String, StringBuilder> inTextBufs = new ConcurrentHashMap<>();

    protected AiProxyWebSocketHandler(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    /**
     * Subclasses resolve the upstream AI WebSocket URL from the frontend session's
     * URI query params (e.g. classId, cameraId, student_id).
     */
    protected abstract String resolveAiTargetUrl(WebSocketSession frontendSession);

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String sid = session.getId();
        String targetUrl = resolveAiTargetUrl(session);
        if (targetUrl == null) {
            closeQuietly(session, CloseStatus.SERVER_ERROR.withReason("Cannot resolve AI server URL"));
            return;
        }
        log.info("[AiProxy] session={} → AI: {}", sid, targetUrl);

        HttpClient.newHttpClient()
                .newWebSocketBuilder()
                .buildAsync(URI.create(targetUrl), new AiListener(session))
                .thenAccept(ws -> {
                    aiSessions.put(sid, ws);
                    ws.request(1);
                    log.info("[AiProxy] Connected to AI for session={}", sid);
                })
                .exceptionally(ex -> {
                    log.error("[AiProxy] Cannot connect to AI {}: {}", targetUrl, ex.getMessage());
                    closeQuietly(session, CloseStatus.SERVER_ERROR.withReason("AI server unavailable"));
                    return null;
                });
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        StringBuilder buf = inTextBufs.computeIfAbsent(session.getId(), k -> new StringBuilder());
        buf.append(message.getPayload());
        if (message.isLast()) {
            String fullMsg = buf.toString();
            buf.setLength(0);
            WebSocket ai = aiSessions.get(session.getId());
            if (ai != null) ai.sendText(fullMsg, true);
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        ByteArrayOutputStream buf = inBinaryBufs.computeIfAbsent(
                session.getId(), k -> new ByteArrayOutputStream());
        ByteBuffer payload = message.getPayload();
        byte[] chunk = new byte[payload.remaining()];
        payload.get(chunk);
        buf.write(chunk, 0, chunk.length);
        if (message.isLast()) {
            byte[] fullMsg = buf.toByteArray();
            buf.reset();
            WebSocket ai = aiSessions.get(session.getId());
            if (ai != null) ai.sendBinary(ByteBuffer.wrap(fullMsg), true);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sid = session.getId();
        inBinaryBufs.remove(sid);
        inTextBufs.remove(sid);
        WebSocket ai = aiSessions.remove(sid);
        if (ai != null) {
            ai.sendClose(WebSocket.NORMAL_CLOSURE, "frontend disconnected")
                    .exceptionally(ex -> {
                        log.warn("[AiProxy] Error closing AI session: {}", ex.getMessage());
                        return null;
                    });
        }
        log.info("[AiProxy] session={} closed: {}", sid, status);
    }

    // supportsPartialMessages=true causes Tomcat to register a MessageHandler.Partial,
    // which streams chunks directly without buffering the whole message first.
    // This bypasses the default 8KB message buffer limit entirely.
    @Override
    public boolean supportsPartialMessages() {
        return true;
    }

    private static void closeQuietly(WebSocketSession s, CloseStatus status) {
        try {
            if (s.isOpen()) s.close(status);
        } catch (IOException ignored) {}
    }

    private class AiListener implements WebSocket.Listener {
        private final WebSocketSession frontend;
        private final StringBuilder textBuf = new StringBuilder();
        private final ByteArrayOutputStream binaryBuf = new ByteArrayOutputStream();

        AiListener(WebSocketSession frontend) {
            this.frontend = frontend;
        }

        @Override
        public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
            textBuf.append(data);
            if (last) {
                String msg = textBuf.toString();
                textBuf.setLength(0);
                sendToFrontend(new TextMessage(msg));
            }
            ws.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onBinary(WebSocket ws, ByteBuffer data, boolean last) {
            byte[] chunk = new byte[data.remaining()];
            data.get(chunk);
            binaryBuf.write(chunk, 0, chunk.length);
            if (last) {
                byte[] fullMsg = binaryBuf.toByteArray();
                binaryBuf.reset();
                sendToFrontend(new BinaryMessage(fullMsg));
            }
            ws.request(1);
            return null;
        }

        @Override
        public void onError(WebSocket ws, Throwable error) {
            log.error("[AiProxy] AI error for session={}: {}", frontend.getId(), error.getMessage());
            aiSessions.remove(frontend.getId());
            closeQuietly(frontend, CloseStatus.SERVER_ERROR);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket ws, int code, String reason) {
            log.info("[AiProxy] AI closed for session={}: {} {}", frontend.getId(), code, reason);
            aiSessions.remove(frontend.getId());
            closeQuietly(frontend, new CloseStatus(code));
            return null;
        }

        private void sendToFrontend(WebSocketMessage<?> msg) {
            try {
                if (frontend.isOpen()) {
                    synchronized (frontend) {
                        frontend.sendMessage(msg);
                    }
                }
            } catch (IOException e) {
                log.error("[AiProxy] Error forwarding to session={}: {}", frontend.getId(), e.getMessage());
            }
        }
    }
}
