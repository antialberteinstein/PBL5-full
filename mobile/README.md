# PBL5 Mobile (Expo + React Native)

Mobile companion to the React web frontend. Restricted to **STUDENT** and
**TEACHER** roles — admin accounts are blocked at the login screen and
should use the web dashboard instead.

Key features:

- Đăng nhập sinh viên / giảng viên qua REST `POST /api/auth/login`
- Đăng ký khuôn mặt bằng camera trước (selfie) — frames JPEG được stream
  qua WebSocket `/ws/register_stream` tới backend, backend đẩy tiếp vào AI server
- Dashboard, danh sách lớp, chi tiết lớp, hồ sơ, đổi mật khẩu
- **Toàn bộ cấu hình LAN nằm trong `config.yaml`** ở thư mục gốc

---

## 1. Cấu hình LAN (`config.yaml`)

File `config.yaml` được Metro bundle vào app và load tự động lúc khởi động
(xem `src/config/index.js`). Sửa file, restart Expo là xong.

```yaml
backend:
  host: "192.168.1.10"    # IPv4 LAN của máy chạy Spring Boot
  port: 8080
  scheme: "http"          # http | https
  wsScheme: "ws"          # ws  | wss
  apiPath: "/api"
  timeoutMs: 10000

app:
  allowedRoles: ["STUDENT", "TEACHER"]   # admin bị chặn

face:
  captureIntervalMs: 450   # ~2.2 fps
  jpegQuality: 0.6
  frameSize: 320
```

### Tìm IP LAN của máy chạy backend

- macOS: `ipconfig getifaddr en0` (Wi-Fi) hoặc `ifconfig | grep "inet "`
- Linux: `hostname -I` / `ip -4 addr`
- Windows: `ipconfig` → tìm "IPv4 Address" của adapter Wi-Fi

⚠️ Không dùng `localhost` / `127.0.0.1` — điện thoại sẽ tự trỏ về chính nó,
không tới được máy tính.

### Yêu cầu phía backend

- Spring Boot phải listen trên `0.0.0.0` (mặc định) chứ không phải `127.0.0.1`.
- Cùng mạng Wi-Fi với điện thoại; tắt firewall hoặc allow inbound cổng 8080.
- Nếu dùng Android không cho cleartext: app đã bật `usesCleartextTraffic: true`.

---

## 2. Cài đặt & chạy

```bash
cd mobile
npm install            # hoặc: yarn / pnpm install
npx expo start --lan   # đảm bảo điện thoại cùng Wi-Fi với máy dev
```

Cài Expo Go từ App Store / Play Store → quét QR Code.

### Quyền camera

App khai báo `NSCameraUsageDescription` (iOS) và `android.permission.CAMERA`.
Lần đầu vào màn hình **Đăng ký khuôn mặt**, app sẽ hỏi cấp quyền.

### Build native (khuyến nghị cho production)

Expo Go đủ để demo flow đăng ký khuôn mặt. Khi cần app cài độc lập:

```bash
npx expo install expo-dev-client
eas build --profile development --platform android
```

---

## 3. Cấu trúc

```
mobile/
├── App.jsx                  # boot: loadConfig() rồi render AppNavigator
├── index.js                 # registerRootComponent(App)
├── config.yaml              # ⬅ LAN host/port — sửa ở đây
├── app.json                 # Expo manifest + camera permission strings
├── metro.config.js          # đăng ký .yaml là asset để require được
└── src/
    ├── config/index.js      # load + parse YAML, expose backendBaseUrl / WS base
    ├── services/api.js      # axios client + endpoint groups (mirrors web)
    ├── utils/auth.js        # AsyncStorage session, JWT exp check, role normalize
    ├── utils/ws.js          # base64 → ArrayBuffer cho WebSocket binary
    ├── navigation/AppNavigator.jsx
    └── screens/
        ├── Login.jsx                 # chặn admin, route theo role + face status
        ├── Dashboard.jsx             # list lớp, CTA đăng ký khuôn mặt
        ├── ClassDetail.jsx
        ├── FaceRegistration.jsx      # CameraView + WS streaming
        └── Profile.jsx
```

---

## 4. Cách face registration hoạt động

1. Sinh viên đăng nhập, nếu `faceRegistered == false` → tự chuyển vào màn
   `FaceRegistration`.
2. Nhấn **Bắt đầu** → app mở WebSocket tới
   `ws://<host>:<port>/ws/register_stream?student_id=<u>&token=<jwt>[&reregister=true]`.
3. `CameraView` (`expo-camera`, facing="front") chụp ảnh ~mỗi
   `face.captureIntervalMs` ms ở chất lượng `face.jpegQuality`, chuyển base64 →
   `ArrayBuffer`, `ws.send(buffer)`.
4. Backend nhận bytes → forward sang AI server (`register_stream.py`) → trả về
   JSON `{ status, req_pose, det_pose, total_collected, total_required, progress_text, ... }`.
5. App cập nhật pose hint + progress bar. Khi `status === "COMPLETE"`, app gọi
   `PUT /api/student-class/face-registered?registered=true` rồi reset stack về
   `Dashboard`.

Trường hợp `ALREADY_REGISTERED` (khuôn mặt đã thuộc về tài khoản khác): app
dừng stream, hiển thị thông báo lỗi và cho thử lại.

---

## 5. Kiểm thử nhanh

| Tình huống                          | Kết quả mong đợi                                              |
|-------------------------------------|---------------------------------------------------------------|
| Đăng nhập sai mật khẩu              | Báo "Sai tên đăng nhập hoặc mật khẩu"                         |
| Đăng nhập tài khoản ADMIN           | Bị chặn ngay với thông báo dùng web                           |
| Student chưa đăng ký khuôn mặt      | Sau login tự vào màn FaceRegistration                          |
| Sai LAN host/port trong config.yaml | App hiện "Mất kết nối với máy chủ" khi mở WebSocket           |
| Không cho quyền camera              | Màn FaceRegistration hiện nút "Cấp quyền camera"              |

---

## 6. FAQ

**Q: Đổi `config.yaml` mà app không nhận?**
A: Vì file được Metro bundle. Restart Expo (`r` trong terminal `expo start`)
hoặc reload bằng cách shake device.

**Q: Có thể đổi LAN host tại runtime không?**
A: Hiện tại không (cố ý giữ đơn giản). Nếu cần, mở rộng `Profile.jsx`
hoặc thêm màn Settings ghi vào `expo-file-system` rồi `loadConfig()` lại.

**Q: Vì sao chặn admin?**
A: Mobile chỉ phục vụ luồng student/teacher (điểm danh + đăng ký khuôn mặt).
Quản trị (tạo user, xếp lịch, duyệt face) vẫn dùng web.
