import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { sendAttendanceSummary } from "./notifier.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", (c) => {
  console.log(`[discord] Đã đăng nhập bot: ${c.user.tag}`);
});

const app = express();
app.use(express.json({ limit: "2mb" }));

// Kiểm tra api key dùng chung giữa backend và bot.
function requireApiKey(req, res, next) {
  const key = req.get("x-api-key");
  if (!key || key !== config.apiKey) {
    return res.status(401).json({ error: "Sai hoặc thiếu x-api-key." });
  }
  return next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, ready: client.isReady() });
});

// Backend gọi endpoint này khi giáo viên đóng điểm danh.
app.post("/notify", requireApiKey, async (req, res) => {
  try {
    if (!client.isReady()) {
      return res.status(503).json({ error: "Bot chưa sẵn sàng (chưa đăng nhập Discord)." });
    }
    await sendAttendanceSummary(client, req.body || {});
    return res.json({ ok: true });
  } catch (err) {
    console.error("[notify] Gửi tin Discord thất bại:", err);
    return res.status(500).json({ error: err.message });
  }
});

async function main() {
  await client.login(config.discordToken);
  app.listen(config.port, () => {
    console.log(`[http] Bot lắng nghe trigger tại http://localhost:${config.port}/notify`);
  });
}

main().catch((err) => {
  console.error("[startup] Không khởi động được bot:", err);
  process.exit(1);
});
