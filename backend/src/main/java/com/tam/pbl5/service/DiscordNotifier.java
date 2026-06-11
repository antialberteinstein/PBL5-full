package com.tam.pbl5.service;

import com.tam.pbl5.dto.request.DiscordAttendancePayload;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Gửi bản tổng kết điểm danh sang bot Discord (POST {discord.bot.url}/notify) kèm
 * header x-api-key. Timeout ngắn để không làm treo request "đóng điểm danh".
 */
@Service
public class DiscordNotifier {

    private final RestClient restClient;
    private final String botUrl;
    private final String apiKey;

    public DiscordNotifier(
            @Value("${discord.bot.url:}") String botUrl,
            @Value("${discord.bot.api-key:}") String apiKey) {
        this.botUrl = botUrl;
        this.apiKey = apiKey;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(3).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(10).toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public void notifyClose(DiscordAttendancePayload payload) {
        if (botUrl == null || botUrl.isBlank()) {
            return; // Chưa cấu hình bot -> bỏ qua, không lỗi.
        }
        restClient.post()
                .uri(botUrl)
                .header("x-api-key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
    }
}
