import { AttachmentBuilder } from "discord.js";
import { config } from "./config.js";

const FETCH_TIMEOUT_MS = 8000;

function toAbsoluteUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return config.backendBaseUrl + path;
}

function safeFileName(student, index, ext) {
  const base = [student.mssv, student.username].filter(Boolean).join("-") || `spoof-${index}`;
  return `${base}`.replace(/[^a-zA-Z0-9._-]/g, "_") + ext;
}

/**
 * Tải ảnh điểm danh của các SV bị nghi gian lận (spoof === true) từ backend
 * và bọc thành AttachmentBuilder để đính kèm tin nhắn Discord.
 * Bỏ qua (log warning) những ảnh tải lỗi để không chặn việc gửi tổng kết.
 */
export async function fetchSpoofAttachments(payload) {
  const suspects = (payload?.attended || []).filter((s) => s.spoof && s.imageUrl);
  const attachments = [];

  for (let i = 0; i < suspects.length; i += 1) {
    const student = suspects[i];
    const url = toAbsoluteUrl(student.imageUrl);
    if (!url) continue;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        console.warn(`[imageFetcher] Tải ảnh lỗi ${res.status} cho ${student.username}: ${url}`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = url.toLowerCase().endsWith(".png") ? ".png" : ".jpg";
      const name = safeFileName(student, i, ext);
      const label = student.fullName || student.username || student.mssv || "Nghi gian lận";
      attachments.push(
        new AttachmentBuilder(buffer, { name, description: `Ảnh nghi gian lận: ${label}` }),
      );
    } catch (err) {
      console.warn(`[imageFetcher] Không tải được ảnh cho ${student.username}: ${err.message}`);
    }
  }

  return attachments;
}
