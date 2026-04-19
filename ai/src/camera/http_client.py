import cv2
import numpy as np
import urllib.request
import time

from config.http_camera_config import HTTP_CAMERA_URL

class HTTPCamera:
    def __init__(self, url=None):
        self.url = url if url else HTTP_CAMERA_URL
        self.stream = None
        self.byte_buffer = b''
        self.connect()

    def connect(self):
        print(f"🔄 Đang kết nối tới {self.url}...")
        try:
            # Bỏ qua proxy để tăng tốc độ mạng nội bộ
            proxy_handler = urllib.request.ProxyHandler({})
            opener = urllib.request.build_opener(proxy_handler)
            urllib.request.install_opener(opener)
            
            # Thời gian chờ ngắn để nếu đứt mạng thì reconnect ngay
            self.stream = urllib.request.urlopen(self.url, timeout=3)
            print("✅ KẾT NỐI CAMERA THÀNH CÔNG!")
        except Exception as e:
            print(f"❌ Lỗi kết nối: {e}")
            self.stream = None
            time.sleep(1)
    
    def send_result(self, message: str) -> None:
        """
        Log result message.
        """
        # logging.info(f"[CAMERA_RESULT] {message}")
        pass

    def capture_frame(self):
        if self.stream is None:
            self.connect()
            return None

        try:
            # Đọc từng khối dữ liệu lớn
            chunk = self.stream.read(4096)
            if not chunk:
                self.stream = None
                return None
                
            self.byte_buffer += chunk
            a = self.byte_buffer.find(b'\xff\xd8') # Điểm bắt đầu ảnh JPEG
            b = self.byte_buffer.find(b'\xff\xd9') # Điểm kết thúc ảnh JPEG
            
            if a != -1 and b != -1:
                jpg = self.byte_buffer[a:b+2]
                self.byte_buffer = self.byte_buffer[b+2:]
                
                # ==========================================
                # BÍ QUYẾT CHỐNG LAG Ở ĐÂY:
                # Nếu mạng WiFi lag làm dữ liệu dồn ứ > 200KB (vài frame cũ)
                # Ta sẽ xóa sạch buffer đi để lấy frame mới nhất (Real-time)
                # ==========================================
                if len(self.byte_buffer) > 200000: 
                    self.byte_buffer = b'' 
                    
                frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                return frame
                
        except Exception as e:
            # Nếu ESP32 rớt mạng, hàm này bắt lỗi êm ru và thử lại
            print("⚠️ Camera rớt mạng, đang kết nối lại...")
            self.stream = None
            
        return None

    def release(self):
        if self.stream:
            self.stream.close()