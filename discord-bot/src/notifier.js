import { config } from "./config.js";
import { buildEmbed } from "./messageBuilder.js";
import { fetchSpoofAttachments } from "./imageFetcher.js";

const MAX_FILES_PER_MESSAGE = 10; // Discord giới hạn 10 file/tin nhắn.

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

/**
 * Gửi bản tổng kết điểm danh vào channel duy nhất đã cấu hình.
 * Tin đầu gồm embed + tối đa 10 ảnh nghi gian lận; nếu còn dư ảnh thì gửi tiếp
 * các tin chỉ chứa ảnh.
 */
export async function sendAttendanceSummary(client, payload) {
  const channel = await client.channels.fetch(config.channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Channel ${config.channelId} không tồn tại hoặc không phải text channel.`);
  }

  const embed = buildEmbed(payload);
  const attachments = await fetchSpoofAttachments(payload);
  const batches = chunk(attachments, MAX_FILES_PER_MESSAGE);

  // Tin đầu tiên: embed + nhóm ảnh đầu (nếu có).
  await channel.send({ embeds: [embed], files: batches[0] || [] });

  // Các nhóm ảnh còn lại (hiếm khi xảy ra): gửi tiếp.
  for (let i = 1; i < batches.length; i += 1) {
    await channel.send({ files: batches[i] });
  }
}
