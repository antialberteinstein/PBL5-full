# PBL5 Discord Bot — Bot điểm danh

Một bot Discord **duy nhất** gửi bản tổng kết vào **một channel duy nhất** mỗi khi giáo
viên bấm **"Đóng điểm danh"** trên web. Tin nhắn gồm: tên giáo viên (in đậm), SĐT, tổng
kết (sĩ số / có mặt / vắng), số SV nghi gian lận, danh sách SV đã điểm danh, và **đính
kèm ảnh điểm danh của các SV bị nghi gian lận**.

```
Frontend "Đóng điểm danh"
   └─> POST /api/attendance/{id}/close   (backend Spring Boot)
          └─> POST http://localhost:3001/notify  (x-api-key)  → bot này
                 └─> gửi embed + ảnh vào channel Discord
```

## 1. Tạo bot trên Discord

1. Vào https://discord.com/developers/applications → **New Application**.
2. Tab **Bot** → **Reset Token** → copy token (điền vào `DISCORD_BOT_TOKEN`).
3. Tab **OAuth2 > URL Generator**: chọn scope `bot`, quyền `Send Messages` + `Attach Files`.
   Mở URL sinh ra để mời bot vào server.
4. Bật **User Settings > Advanced > Developer Mode**, chuột phải channel đích → **Copy Channel ID**
   (điền vào `DISCORD_CHANNEL_ID`).

## 2. Cài đặt & chạy

```bash
cd discord-bot
cp .env.example .env      # rồi điền token, channel id, BOT_API_KEY
npm install
npm start
```

Khi chạy thành công sẽ thấy log `Đã đăng nhập bot: <tên>#0000` và
`Bot lắng nghe trigger tại http://localhost:3001/notify`.

`BOT_API_KEY` **phải khớp** với `discord.bot.api-key` trong
`backend/src/main/resources/application.properties`.

## 3. Biến môi trường (`.env`)

| Biến | Ý nghĩa |
|------|---------|
| `DISCORD_BOT_TOKEN` | Token bot Discord |
| `DISCORD_CHANNEL_ID` | ID channel duy nhất để gửi tin |
| `BOT_API_KEY` | Key dùng chung, backend gửi qua header `x-api-key` |
| `PORT` | Cổng HTTP nhận trigger (mặc định 3001) |
| `BACKEND_BASE_URL` | Base URL backend để tải ảnh điểm danh |

## 4. API

### `GET /health`
Trả `{ "ok": true, "ready": <đã login Discord chưa> }`.

### `POST /notify`
Header bắt buộc: `x-api-key: <BOT_API_KEY>` (sai → 401). Body JSON:

```json
{
  "teacherName": "Nguyễn Văn A",
  "teacherPhone": "0901234567",
  "className": "Lập trình Web",
  "sessionTime": "2026-06-11T08:00:00",
  "total": 40, "present": 35, "absent": 5, "spoofCount": 2,
  "attended": [
    { "mssv": "102210001", "fullName": "Trần Thị B", "username": "tranthib",
      "checkinTime": "2026-06-11T08:02:11",
      "imageUrl": "/uploads/attendance/x.jpg", "spoof": true }
  ]
}
```

Chỉ những SV `spoof: true` và có `imageUrl` mới được đính kèm ảnh (tối đa 10 ảnh/tin,
phần dư gửi sang tin kế tiếp).

## 5. Test nhanh

```bash
# Sai key -> 401
curl -i -X POST http://localhost:3001/notify -H "x-api-key: wrong" -d '{}'

# Gửi thử bằng payload mẫu
curl -X POST http://localhost:3001/notify \
  -H "x-api-key: <BOT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d @sample-payload.json
```
