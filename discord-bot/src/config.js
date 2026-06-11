import "dotenv/config";

/**
 * Đọc và kiểm tra biến môi trường. Thoát sớm nếu thiếu cấu hình bắt buộc
 * để tránh bot chạy nửa vời (login fail / không biết gửi vào channel nào).
 */
function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`[config] Thiếu biến môi trường bắt buộc: ${name}. Hãy copy .env.example -> .env và điền.`);
    process.exit(1);
  }
  return value.trim();
}

export const config = {
  discordToken: required("DISCORD_BOT_TOKEN"),
  channelId: required("DISCORD_CHANNEL_ID"),
  apiKey: required("BOT_API_KEY"),
  port: Number(process.env.PORT) || 3001,
  // Dùng để ghép với imageUrl dạng "/uploads/..." khi tải ảnh điểm danh từ backend.
  backendBaseUrl: (process.env.BACKEND_BASE_URL || "http://localhost:8080").replace(/\/$/, ""),
};
