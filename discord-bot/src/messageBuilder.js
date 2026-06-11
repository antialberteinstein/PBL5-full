import { EmbedBuilder } from "discord.js";

const EMBED_DESC_LIMIT = 4096;

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
}

/**
 * Dựng dòng text cho từng SV đã điểm danh, gắn ⚠️ nếu bị AI nghi gian lận.
 */
function studentLine(s) {
  const flag = s.spoof ? " ⚠️ **(nghi gian lận)**" : "";
  const name = s.fullName || s.username || "(không tên)";
  const mssv = s.mssv ? `\`${s.mssv}\` ` : "";
  return `• ${mssv}${name} — ${formatTime(s.checkinTime)}${flag}`;
}

/**
 * Ghép danh sách SV đã điểm danh thành description, cắt theo giới hạn 4096 ký tự
 * của Discord embed; phần dư ghi gọn "…và N SV khác".
 */
function buildAttendedList(attended) {
  if (!attended || attended.length === 0) {
    return "_Chưa có sinh viên nào điểm danh._";
  }

  const header = "**Danh sách sinh viên đã điểm danh:**\n";
  const lines = [];
  let length = header.length;

  for (let i = 0; i < attended.length; i += 1) {
    const line = studentLine(attended[i]) + "\n";
    const remaining = attended.length - i;
    const tail = `…và ${remaining} sinh viên khác`;
    // Chừa chỗ cho dòng tail phòng khi tràn.
    if (length + line.length + tail.length > EMBED_DESC_LIMIT) {
      lines.push(tail);
      break;
    }
    lines.push(line.trimEnd());
    length += line.length;
  }

  return header + lines.join("\n");
}

/**
 * Tạo embed tổng kết điểm danh. Tên giáo viên được highlight (in đậm + author).
 */
export function buildEmbed(payload) {
  const {
    teacherName = "(không rõ)",
    teacherPhone = "—",
    className = "—",
    sessionTime,
    total = 0,
    present = 0,
    absent = 0,
    spoofCount = 0,
    attended = [],
  } = payload || {};

  const color = spoofCount > 0 ? 0xe74c3c : 0x2ecc71; // đỏ nếu có nghi gian lận, xanh nếu sạch

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `👨‍🏫 ${teacherName}` })
    .setTitle("📋 Tổng kết điểm danh")
    .setDescription(
      `Giáo viên phụ trách: **${teacherName}**\n` +
        `☎️ SĐT: **${teacherPhone}**\n\n` +
        buildAttendedList(attended),
    )
    .addFields(
      { name: "🏫 Lớp", value: String(className), inline: true },
      { name: "🕒 Buổi học", value: formatTime(sessionTime), inline: true },
      { name: "​", value: "​", inline: true },
      { name: "📊 Sĩ số", value: String(total), inline: true },
      { name: "✅ Có mặt", value: String(present), inline: true },
      { name: "❌ Vắng", value: String(absent), inline: true },
      { name: "🚨 Nghi gian lận", value: String(spoofCount), inline: true },
    )
    .setTimestamp(new Date());
}
