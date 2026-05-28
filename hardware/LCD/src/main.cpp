/**
 * ================================================================
 *  HỆ THỐNG ĐIỂM DANH AI - GIAO DIỆN MÀN HÌNH TFT 240x240
 *  ESP32 + TFT_eSPI + VLW Font (Tiếng Việt đầy đủ)
 * ================================================================
 *
 *  ĐỂ HIỂN THỊ TIẾNG VIỆT:
 *  1. Cài Processing (https://processing.org)
 *  2. Mở sketch: TFT_eSPI/tools/Create_font/Create_font.pde
 *  3. Chọn font: "NotoSans-Regular" hoặc "Roboto-Regular"
 *  4. Size: 18 (cho body), 24 (cho heading), 28 (cho status)
 *  5. Tick "Unicode" → nhập range: 0x0020-0x007E, 0x00C0-0x024F, 0x1E00-0x1EFF
 *  6. Export → đặt file .vlw vào thư mục /data/ của project
 *  7. Upload SPIFFS: pio run --target uploadfs (PlatformIO)
 *     hoặc: Tools → ESP32 Sketch Data Upload (Arduino IDE + ESP32FS plugin)
 *
 *  CÁC FILE VLW CẦN CÓ TRONG /data/:
 *  - NotoSans18.vlw   (thông tin sinh viên)
 *  - NotoSans24.vlw   (tên sinh viên)
 *  - NotoSans28.vlw   (trạng thái)
 *  - NotoSans14.vlw   (nhãn nhỏ)
 * ================================================================
 */

#include <Arduino.h>
#include <TFT_eSPI.h>
#include <SPI.h>
#include "FS.h"
#include <SPIFFS.h>

// ================================================================
// CẤU HÌNH PHẦN CỨNG
// ================================================================
#define BUZZER_PIN 13

TFT_eSPI tft = TFT_eSPI();

// ================================================================
// BẢN MÀU (Color Palette) - Dark Professional Theme
// ================================================================
#define C_BG          tft.color565(10,  12,  20)   // Nền chính: Xanh đen rất tối
#define C_PANEL       tft.color565(18,  24,  42)   // Nền panel: Xanh navy tối
#define C_HEADER      tft.color565(25,  35,  65)   // Header: Navy đậm
#define C_ACCENT      tft.color565(64, 156, 255)   // Accent: Xanh điện
#define C_DIVIDER     tft.color565(40,  50,  80)   // Đường kẻ: Navy nhạt
#define C_WHITE       TFT_WHITE
#define C_GREY        tft.color565(160, 170, 195)  // Xám xanh nhạt
#define C_DARK_GREY   tft.color565(80,  90, 115)   // Xám xanh tối
#define C_YELLOW      tft.color565(255, 220,  60)  // Vàng tươi
#define C_GREEN       tft.color565(40,  210, 130)  // Xanh lá tươi
#define C_ORANGE      tft.color565(255, 150,  40)  // Cam tươi
#define C_RED         tft.color565(255,  65,  65)  // Đỏ tươi

// ================================================================
// CÁC TRẠNG THÁI ĐIỂM DANH
// ================================================================
const int STATUS_OK       = 0;  // Đúng giờ
const int STATUS_LATE     = 1;  // Đi muộn
const int STATUS_WRONG_CA = 2;  // Sai ca học
const int STATUS_UNKNOWN  = 3;  // Người lạ

// ================================================================
// KHAI BÁO HÀM
// ================================================================
void drawAttendanceUI(String monHoc, String tenSV, String mssv, String lop,
                      String thoiGian, int trangThai);
void drawHeader(String monHoc, int trangThai);
void drawStudentCard(String tenSV, String mssv, String lop, String thoiGian);
void drawStatusBox(int trangThai);
void drawDivider(int y, uint16_t color);
void drawAvatarCircle(int cx, int cy, int r, String initials, uint16_t color);
void drawSignalBars(int x, int y, uint16_t color);
void triggerBuzzer(int trangThai);
bool loadVlwFont(String fontName);

// ================================================================
// SETUP
// ================================================================
void setup() {
  Serial.begin(115200);

  // Khởi tạo còi báo
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Khởi tạo SPIFFS để đọc font VLW
  if (!SPIFFS.begin(true)) {
    Serial.println("[LỖI] Không mount được SPIFFS! Kiểm tra lại file font.");
  } else {
    Serial.println("[OK] SPIFFS đã sẵn sàng.");
  }

  // Khởi tạo màn hình TFT
  tft.init();
  tft.setRotation(1);           // Xoay ngang: 240 (rộng) x 240 (cao)
  tft.fillScreen(C_BG);
  tft.setSwapBytes(true);       // Bắt buộc khi dùng VLW font trên ESP32

  // Màn hình khởi động ngắn
  tft.setTextColor(C_ACCENT, C_BG);
  tft.drawCentreString("HE THONG DIEM DANH AI", 120, 100, 2);
  tft.setTextColor(C_GREY, C_BG);
  tft.drawCentreString("Dang khoi dong...", 120, 125, 1);
  delay(1500);

  Serial.println("[INFO] Bắt đầu vòng lặp mô phỏng UI...");
}

// ================================================================
// LOOP - CÁC KỊCH BẢN MÔ PHỎNG
// ================================================================
void loop() {
  // KỊCH BẢN 1: Đúng giờ
  Serial.println("[SIM] Trạng thái: ĐÚNG GIỜ");
  drawAttendanceUI(
    "PBL5: Hệ thống điểm danh AI",
    "NGÔ VĂN QUẢNG LONG",
    "10221045",
    "21T_ĐT1",
    "07:12:45",
    STATUS_OK
  );
  delay(5000);

  // KỊCH BẢN 2: Đi muộn
  Serial.println("[SIM] Trạng thái: ĐI MUỘN");
  drawAttendanceUI(
    "PBL5: Hệ thống điểm danh AI",
    "NGUYỄN XUÂN TÂM",
    "10221087",
    "21T_ĐT1",
    "07:35:12",
    STATUS_LATE
  );
  delay(5000);

  // KỊCH BẢN 3: Sai ca học
  Serial.println("[SIM] Trạng thái: SAI CA HỌC");
  drawAttendanceUI(
    "KHDL: Phân tích dữ liệu",
    "HUỲNH NGỌC VÂN ANH",
    "10221062",
    "21T_ĐT2",
    "13:15:20",
    STATUS_WRONG_CA
  );
  delay(5000);

  // KỊCH BẢN 4: Người lạ / Không nhận ra
  Serial.println("[SIM] Trạng thái: NGƯỜI LẠ");
  drawAttendanceUI(
    "HỆ THỐNG AN NINH",
    "KHÔNG XÁC ĐỊNH",
    "--------",
    "KHÔNG HỢP LỆ",
    "09:42:01",
    STATUS_UNKNOWN
  );
  delay(5000);
}

// ================================================================
// HÀM VẼ GIAO DIỆN CHÍNH
// ================================================================
void drawAttendanceUI(String monHoc, String tenSV, String mssv, String lop,
                      String thoiGian, int trangThai) {
  // Xóa màn hình về nền tối
  tft.fillScreen(C_BG);

  drawHeader(monHoc, trangThai);        // Vùng 1: Header (y: 0-44)
  drawStudentCard(tenSV, mssv, lop, thoiGian);  // Vùng 2: Thông tin SV (y: 45-175)
  drawStatusBox(trangThai);             // Vùng 3: Trạng thái (y: 178-240)

  triggerBuzzer(trangThai);
}

// ================================================================
// VÙNG 1: HEADER (0 → 44px)
// ================================================================
void drawHeader(String monHoc, int trangThai) {
  // Nền header với gradient tối
  tft.fillRect(0, 0, 240, 44, C_HEADER);

  // Đường viền dưới header (accent line)
  uint16_t accentColor;
  switch (trangThai) {
    case STATUS_OK:       accentColor = C_GREEN;  break;
    case STATUS_LATE:     accentColor = C_ORANGE; break;
    case STATUS_WRONG_CA: accentColor = C_RED;    break;
    case STATUS_UNKNOWN:  accentColor = C_RED;    break;
    default:              accentColor = C_ACCENT; break;
  }
  tft.fillRect(0, 42, 240, 2, accentColor);  // Đường viền màu 2px

  // Icon nhỏ bên trái (hình chấm nhỏ biểu thị loại)
  tft.fillCircle(14, 22, 5, accentColor);

  // Nhãn "ĐIỂM DANH" góc trái nhỏ
  // (Dùng font mặc định vì đây chỉ là label phụ, không cần tiếng Việt)
  tft.setTextColor(accentColor, C_HEADER);
  tft.drawString("DIEM DANH", 26, 8, 1);

  // Tên môn học — Dùng VLW font nếu có, fallback sang built-in
  if (loadVlwFont("NotoSans14")) {
    tft.setTextColor(C_WHITE, C_HEADER);
    tft.setTextDatum(TC_DATUM);     // Căn giữa trên
    tft.drawString(monHoc, 120, 24);
    tft.unloadFont();
    tft.setTextDatum(TL_DATUM);     // Reset về mặc định
  } else {
    // Fallback: built-in font (sẽ không có dấu, nhưng vẫn hiển thị được layout)
    tft.setTextColor(C_WHITE, C_HEADER);
    tft.drawCentreString(monHoc, 120, 22, 1);
  }

  // Hiển thị signal bars góc phải (biểu thị kết nối WiFi/BT)
  drawSignalBars(210, 10, C_ACCENT);
}

// ================================================================
// VÙNG 2: THÔNG TIN SINH VIÊN (45 → 175px)
// ================================================================
void drawStudentCard(String tenSV, String mssv, String lop, String thoiGian) {
  int panelY = 46;
  int panelH = 128;

  // Panel nền tối hơn nền chính một chút
  tft.fillRect(0, panelY, 240, panelH, C_PANEL);

  // Vòng tròn avatar bên trái - lấy 2 chữ đầu tên làm initials
  String initials = "";
  if (tenSV.length() > 0) {
    // Lấy chữ cái đầu tiên và cuối của từ đầu (giản lược - chỉ ASCII)
    initials = String(tenSV[0]);
  }
  drawAvatarCircle(36, panelY + 32, 26, initials, C_ACCENT);

  // ==== CỘT PHẢI: Thông tin ====
  int textX = 72;   // Điểm bắt đầu cột chữ

  if (loadVlwFont("NotoSans24")) {
    // TÊN SINH VIÊN - to và nổi bật
    tft.setTextColor(C_WHITE, C_PANEL);
    tft.setTextDatum(TL_DATUM);

    // Rút ngắn tên nếu quá dài để vừa màn hình
    String displayName = tenSV;
    while (tft.textWidth(displayName) > 162 && displayName.length() > 3) {
      displayName = displayName.substring(0, displayName.length() - 1);
    }
    if (displayName.length() < tenSV.length()) displayName += ".";

    tft.drawString(displayName, textX, panelY + 8);
    tft.unloadFont();
  } else {
    tft.setTextColor(C_WHITE, C_PANEL);
    tft.drawString(tenSV, textX, panelY + 10, 2);
  }

  // Đường phân cách mảnh dưới tên
  tft.drawFastHLine(textX, panelY + 42, 162, C_DIVIDER);

  if (loadVlwFont("NotoSans18")) {
    tft.setTextColor(C_GREY, C_PANEL);
    tft.setTextDatum(TL_DATUM);

    // MSSV
    tft.setTextColor(C_DARK_GREY, C_PANEL);
    tft.drawString("MSSV", textX, panelY + 50);
    tft.setTextColor(C_GREY, C_PANEL);
    tft.drawString(mssv, textX + 55, panelY + 50);

    // LỚP
    tft.setTextColor(C_DARK_GREY, C_PANEL);
    tft.drawString("Lớp", textX, panelY + 74);
    tft.setTextColor(C_GREY, C_PANEL);
    tft.drawString(lop, textX + 55, panelY + 74);

    tft.unloadFont();
  } else {
    tft.setTextColor(C_GREY, C_PANEL);
    tft.drawString("MSSV: " + mssv, textX, panelY + 50, 1);
    tft.drawString("Lop:  " + lop,  textX, panelY + 68, 1);
  }

  // ---- HÀNG THỜI GIAN QUÉT (toàn chiều ngang, nằm cuối panel) ----
  int timeBarY = panelY + panelH - 28;
  tft.fillRect(0, timeBarY, 240, 28, tft.color565(14, 20, 38));

  // Biểu tượng đồng hồ nhỏ (vẽ bằng vòng tròn + vạch)
  int clockX = 16, clockY = timeBarY + 14;
  tft.drawCircle(clockX, clockY, 7, C_YELLOW);
  tft.drawFastVLine(clockX, clockY - 4, 5, C_YELLOW);
  tft.drawFastHLine(clockX, clockY, 4, C_YELLOW);

  if (loadVlwFont("NotoSans18")) {
    tft.setTextColor(C_YELLOW, tft.color565(14, 20, 38));
    tft.setTextDatum(TL_DATUM);
    tft.drawString("Giờ quét:  " + thoiGian, 30, timeBarY + 5);
    tft.unloadFont();
  } else {
    tft.setTextColor(C_YELLOW, tft.color565(14, 20, 38));
    tft.drawString("Gio quet: " + thoiGian, 30, timeBarY + 8, 2);
  }
}

// ================================================================
// VÙNG 3: STATUS BOX (178 → 240px)
// ================================================================
void drawStatusBox(int trangThai) {
  uint16_t statusColor;
  String   statusText;
  String   subText;

  switch (trangThai) {
    case STATUS_OK:
      statusColor = C_GREEN;
      statusText  = "✓  ĐÚNG GIỜ";
      subText     = "Điểm danh thành công";
      break;
    case STATUS_LATE:
      statusColor = C_ORANGE;
      statusText  = "⚠  ĐI MUỘN";
      subText     = "Vui lòng xin phép GV";
      break;
    case STATUS_WRONG_CA:
      statusColor = C_RED;
      statusText  = "✕  SAI CA HỌC";
      subText     = "Không có lịch học ca này";
      break;
    case STATUS_UNKNOWN:
      statusColor = C_RED;
      statusText  = "!  NGƯỜI LẠ";
      subText     = "Cảnh báo bảo mật!";
      break;
    default:
      statusColor = C_ACCENT;
      statusText  = "...  ĐANG XỬ LÝ";
      subText     = "";
      break;
  }

  int boxY = 178;
  int boxH = 240 - boxY;  // = 62px

  // Nền trạng thái - màu sắc tương ứng nhưng tối hơn (~40% opacity giả)
  // Tính màu tối hơn: pha với nền
  uint16_t darkColor = tft.color565(
    ((statusColor >> 11) & 0x1F) * 2,          // R
    ((statusColor >> 5)  & 0x3F) * 1,           // G
    ( statusColor        & 0x1F) * 2            // B
  );
  tft.fillRect(0, boxY, 240, boxH, darkColor);

  // Đường viền trên, dày 3px
  tft.fillRect(0, boxY, 240, 3, statusColor);

  // Indicator bar bên trái (thick left border)
  tft.fillRect(0, boxY + 3, 5, boxH - 3, statusColor);

  // Nếu UNKNOWN: nhấp nháy background
  if (trangThai == STATUS_UNKNOWN) {
    // Gọi buzzer trước khi vẽ nhấp nháy để không block
    for (int i = 0; i < 2; i++) {
      tft.fillRect(0, boxY, 240, boxH, C_RED);
      delay(120);
      tft.fillRect(0, boxY, 240, boxH, darkColor);
      delay(120);
    }
    // Vẽ lại border sau nhấp nháy
    tft.fillRect(0, boxY, 240, 3, statusColor);
    tft.fillRect(0, boxY + 3, 5, boxH - 3, statusColor);
  }

  // Chữ trạng thái chính - FONT LỚN
  if (loadVlwFont("NotoSans28")) {
    tft.setTextColor(C_WHITE, darkColor);
    tft.setTextDatum(TC_DATUM);
    tft.drawString(statusText, 122, boxY + 6);
    tft.unloadFont();
  } else {
    tft.setTextColor(C_WHITE, darkColor);
    tft.drawCentreString(statusText, 122, boxY + 8, 4);
  }

  // Sub-text nhỏ bên dưới
  if (loadVlwFont("NotoSans14")) {
    tft.setTextColor(statusColor, darkColor);
    tft.setTextDatum(TC_DATUM);
    tft.drawString(subText, 122, boxY + 42);
    tft.unloadFont();
    tft.setTextDatum(TL_DATUM);
  } else {
    tft.setTextColor(statusColor, darkColor);
    tft.drawCentreString(subText, 122, boxY + 44, 1);
  }
}

// ================================================================
// HÀM PHỤ: Vẽ vòng tròn avatar + chữ initials
// ================================================================
void drawAvatarCircle(int cx, int cy, int r, String initials, uint16_t color) {
  // Vòng ngoài (border)
  tft.fillCircle(cx, cy, r, color);
  // Vòng trong (fill tối hơn)
  tft.fillCircle(cx, cy, r - 3, tft.color565(20, 28, 55));

  // Chữ initials căn giữa vòng tròn
  tft.setTextColor(color, tft.color565(20, 28, 55));
  tft.drawCentreString(initials, cx, cy - 7, 2);
}

// ================================================================
// HÀM PHỤ: Vẽ 3 thanh signal (WiFi/BT indicator)
// ================================================================
void drawSignalBars(int x, int y, uint16_t color) {
  // 3 cột tăng dần chiều cao
  int heights[] = {4, 7, 10};
  int widths = 4;
  int gap    = 3;
  for (int i = 0; i < 3; i++) {
    int bx = x + i * (widths + gap);
    int bh = heights[i];
    int by = y + 10 - bh;
    tft.fillRect(bx, by, widths, bh, (i < 2) ? color : C_DARK_GREY);
  }
}

// ================================================================
// HÀM PHỤ: Kẻ đường phân cách ngang
// ================================================================
void drawDivider(int y, uint16_t color) {
  tft.drawFastHLine(10, y, 220, color);
}

// ================================================================
// HÀM PHỤ: Load VLW font từ SPIFFS (trả về false nếu thất bại)
// ================================================================
bool loadVlwFont(String fontName) {
  String path = "/" + fontName + ".vlw";
  if (!SPIFFS.exists(path)) {
    // Font file không tồn tại → sẽ dùng built-in font
    return false;
  }
  tft.loadFont(fontName, SPIFFS);
  return true;
}

// ================================================================
// HÀM PHỤ: Điều khiển còi báo
// ================================================================
void triggerBuzzer(int trangThai) {
  switch (trangThai) {
    case STATUS_OK:
      // 1 tiếng bíp ngắn - xác nhận
      digitalWrite(BUZZER_PIN, HIGH); delay(120);
      digitalWrite(BUZZER_PIN, LOW);
      break;

    case STATUS_LATE:
      // 2 tiếng tít tít - cảnh báo nhẹ
      digitalWrite(BUZZER_PIN, HIGH); delay(100);
      digitalWrite(BUZZER_PIN, LOW);  delay(80);
      digitalWrite(BUZZER_PIN, HIGH); delay(100);
      digitalWrite(BUZZER_PIN, LOW);
      break;

    case STATUS_WRONG_CA:
      // 3 tiếng ngắn liên tiếp - từ chối
      for (int i = 0; i < 3; i++) {
        digitalWrite(BUZZER_PIN, HIGH); delay(80);
        digitalWrite(BUZZER_PIN, LOW);  delay(60);
      }
      break;

    case STATUS_UNKNOWN:
      // 1 tiếng kéo dài + 2 ngắn - CẢNH BÁO
      digitalWrite(BUZZER_PIN, HIGH); delay(500);
      digitalWrite(BUZZER_PIN, LOW);  delay(80);
      digitalWrite(BUZZER_PIN, HIGH); delay(100);
      digitalWrite(BUZZER_PIN, LOW);  delay(60);
      digitalWrite(BUZZER_PIN, HIGH); delay(100);
      digitalWrite(BUZZER_PIN, LOW);
      break;
  }
}