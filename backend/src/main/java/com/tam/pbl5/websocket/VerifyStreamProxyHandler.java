package com.tam.pbl5.websocket;

import com.tam.pbl5.entity.Camera;
import com.tam.pbl5.repository.CameraRepository;
import com.tam.pbl5.service.JwtService;
import com.tam.pbl5.service.ScheduleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Proxies /ws/verify_stream_local from frontend to the correct AI server.
 *
 * Accepts either:
 *  - ?classId=X  → looks up camera from class schedule (teacher attendance flow)
 *  - ?cameraId=X → looks up camera by ID directly (admin CCTV viewer)
 */
@Slf4j
@Component
public class VerifyStreamProxyHandler extends AiProxyWebSocketHandler {

    private final ScheduleService scheduleService;
    private final CameraRepository cameraRepository;

    public VerifyStreamProxyHandler(JwtService jwtService,
                                    ScheduleService scheduleService,
                                    CameraRepository cameraRepository) {
        super(jwtService);
        this.scheduleService = scheduleService;
        this.cameraRepository = cameraRepository;
    }

    @Override
    protected String resolveAiTargetUrl(WebSocketSession session) {
        String query = session.getUri().getQuery();
        if (query == null || query.isBlank()) {
            log.error("[VerifyProxy] Missing classId or cameraId param");
            return null;
        }

        Map<String, String> params = Arrays.stream(query.split("&"))
                .filter(p -> p.contains("="))
                .collect(Collectors.toMap(
                        p -> p.split("=", 2)[0],
                        p -> p.split("=", 2)[1],
                        (a, b) -> a
                ));

        try {
            Camera camera;
            if (params.containsKey("classId")) {
                camera = scheduleService.getCurrentActiveCameraForClass(
                        Integer.parseInt(params.get("classId")));
            } else if (params.containsKey("cameraId")) {
                camera = cameraRepository.findById(Integer.parseInt(params.get("cameraId")))
                        .orElseThrow(() -> new RuntimeException("Camera not found"));
            } else {
                log.error("[VerifyProxy] Neither classId nor cameraId provided");
                return null;
            }

            if (camera.getAiServerUrl() == null || camera.getAiServerUrl().isBlank()) {
                log.error("[VerifyProxy] Camera has no AI server URL configured");
                return null;
            }

            return toWs(camera.getAiServerUrl()) + "/ws/verify_stream_local";
        } catch (Exception e) {
            log.error("[VerifyProxy] Cannot resolve AI URL: {}", e.getMessage());
            return null;
        }
    }

    private static String toWs(String url) {
        return url.replaceFirst("^http://", "ws://")
                  .replaceFirst("^https://", "wss://")
                  .replaceAll("/$", "");
    }
}
