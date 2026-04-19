import os
import sys
import time
import cv2
import numpy as np
import insightface
from insightface.utils import face_align

# Thêm thư mục finetune-recog-backbone vào sys.path để import config
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from config.config import FACE_CROP_SIZE

def augment_and_save(aligned_face: np.ndarray, out_dir: str, prefix: str, ts: int):
    """
    Áp dụng các kỹ thuật tăng cường dữ liệu và lưu ảnh.
    Không thêm padding, chỉ dùng crop size đã căn chỉnh.
    """
    # 1. Ảnh gốc
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_raw.jpg"), aligned_face)
    
    # 2. Gaussian Blur (Nhẹ và Nặng)
    blur_light = cv2.GaussianBlur(aligned_face, (3, 3), 0)
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_blurlight.jpg"), blur_light)
    
    blur_heavy = cv2.GaussianBlur(aligned_face, (7, 7), 0)
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_blurheavy.jpg"), blur_heavy)
    
    # 3. Brightness (ColorJitter)
    bright_up = cv2.convertScaleAbs(aligned_face, alpha=1.2, beta=20)
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_brightup.jpg"), bright_up)
    
    bright_down = cv2.convertScaleAbs(aligned_face, alpha=0.8, beta=-20)
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_brightdown.jpg"), bright_down)
    
    # 4. Contrast
    contrast_up = cv2.convertScaleAbs(aligned_face, alpha=1.5, beta=0)
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_contrastup.jpg"), contrast_up)
    
    contrast_down = cv2.convertScaleAbs(aligned_face, alpha=0.5, beta=0)
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_contrastdown.jpg"), contrast_down)
    
    # 5. Mix (Lật ngang + Blur nhẹ + Tương phản)
    flipped = cv2.flip(aligned_face, 1)
    mix = cv2.GaussianBlur(flipped, (3, 3), 0)
    mix = cv2.convertScaleAbs(mix, alpha=1.3, beta=10)
    cv2.imwrite(os.path.join(out_dir, f"{prefix}_{ts}_mix.jpg"), mix)

def pick_largest_face(faces):
    if not faces:
        return None
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

def capture_dataset():
    label = input("🪪 Nhập ID hoặc Tên Nhãn (VD: 102210, NguyenVanA): ").strip()
    if not label:
        print("❌ Lỗi: Mã định danh không được để trống!")
        return
        
    out_dir = os.path.join(ROOT_DIR, f"dataset/{label}")
    os.makedirs(out_dir, exist_ok=True)
    
    print("⏳ Đang khởi động AI quét khuôn mặt...")
    app = insightface.app.FaceAnalysis(name='buffalo_l', allowed_modules=['detection'])
    
    # Tự động chọn thiết bị
    import torch
    if torch.cuda.is_available():
        ctx_id = 0
    elif torch.backends.mps.is_available():
        ctx_id = 0 # InsightFace có thể chưa hỗ trợ MPS tốt, nếu lỗi sẽ tự fallback
    else:
        ctx_id = -1
        
    try:
        app.prepare(ctx_id=ctx_id, det_size=(640, 640))
    except Exception:
        # Fallback về CPU nếu GPU backend fail
        app.prepare(ctx_id=-1, det_size=(640, 640))
    
    cap = cv2.VideoCapture(0)
    
    target_frames = 15
    last_capture_time = 0
    capture_count = 0
    
    print("\n" + "="*50)
    print("📸 HƯỚNG DẪN LẤY DATASET 📸")
    print(f"Mỗi 1 giây máy sẽ TỰ ĐỘNG CHỤP khuôn mặt lớn nhất.")
    print(f"Sẽ chụp tổng cộng {target_frames} khung hình (mỗi khung sinh ra 8 biến thể).")
    print("Hãy thay đổi biểu cảm và góc mặt nhẹ nhàng!")
    print("Nhấn phím 'Q' nếu muốn thoát ngang.")
    print("="*50 + "\n")
    
    while cap.isOpened() and capture_count < target_frames:
        ret, frame = cap.read()
        if not ret:
            break
            
        display_frame = frame.copy()
        
        faces = app.get(frame)
        face = pick_largest_face(faces)
        
        if face is not None and face.det_score > 0.5:
            box = face.bbox.astype(int)
            x1, y1, x2, y2 = box
            
            # Vẽ Bounding Box HUD
            cv2.rectangle(display_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Cơ chế chụp tự động mỗi 1s
            current_time = time.time()
            if current_time - last_capture_time > 1.0:
                # 1. Căn chỉnh khuôn mặt (không padding, fix size)
                aligned_crop = face_align.norm_crop(frame, landmark=face.kps, image_size=FACE_CROP_SIZE[0])
                
                if aligned_crop is not None and aligned_crop.size > 0:
                    ts = int(current_time * 1000)
                    # 2. Tăng cường dữ liệu và lưu
                    augment_and_save(aligned_crop, out_dir, label, ts)
                    
                    capture_count += 1
                    last_capture_time = current_time
                    print(f"✅ Đã chụp {capture_count}/{target_frames}...")
        
        # UI Hướng dẫn
        cv2.putText(display_frame, f"Tien do: {capture_count}/{target_frames}", (20, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
                    
        cv2.imshow("AUTO DATASET ALIGNMENT", display_frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == 27:
            print("\n❌ Thoát sớm.")
            break
            
    if capture_count >= target_frames:
        print(f"\n✅ FULL COMBO: Đã lấy đủ {capture_count} khung hình (Tạo ra {capture_count * 8} ảnh) tại '{out_dir}'")
        
    cap.release()
    cv2.destroyAllWindows()
    
    if sys.platform == "darwin":
        for _ in range(30): cv2.waitKey(1)

if __name__ == "__main__":
    capture_dataset()
