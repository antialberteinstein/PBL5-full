from __future__ import annotations

from pathlib import Path
import sys

import cv2
import numpy as np
import torch
from torch.nn import functional as F
from insightface.app import FaceAnalysis
from insightface.utils import face_align

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Dùng import trực tiếp do cùng nằm chung thư mục
from model import EfficientNetB0Classifier
from config import FACE_CROP_SIZE

def preprocess_face(face_bgr: np.ndarray) -> torch.Tensor:
    # 1. Chuyển BGR (OpenCV) sang RGB (ImageFolder / PIL format)
    img = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    
    # 2. Scale về [0, 1]
    img = img.astype(np.float32) / 255.0
    
    # 3. Chuẩn hoá theo mean và std của ImageNet
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img = (img - mean) / std
    
    # 4. Chuyển HWC sang CHW
    img = np.transpose(img, (2, 0, 1))
    return torch.from_numpy(img).unsqueeze(0)

def _coerce_value(raw: str):
    value = raw.strip().strip("\"'")
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        parts = [p.strip() for p in inner.split(",")]
        return [int(p) for p in parts]
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value

def load_config(path: Path) -> dict:
    config: dict = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        value = raw.split("#", 1)[0].strip()
        config[key.strip()] = _coerce_value(value)
    return config

def draw_label(frame: np.ndarray, bbox: np.ndarray, label: str, color: tuple[int, int, int]) -> None:
    x1, y1, x2, y2 = bbox.astype(int)
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    cv2.putText(
        frame,
        label,
        (x1, max(0, y1 - 8)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        color,
        2,
        lineType=cv2.LINE_AA,
    )

def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Test EfficientNet-B0 Softmax pipeline")
    parser.add_argument("--config_path", default="effbetb0-softmax/test.yml", help="Path to config file")
    args = parser.parse_args()

    config_path = Path(args.config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config not found: {config_path}")
    config = load_config(config_path)

    camera_index = int(config.get("camera_index", 0))
    insightface_model = config.get("insightface_model", "buffalo_l")
    det_threshold = float(config.get("det_threshold", 0.5))
    det_size = tuple(config.get("det_size", [640, 640]))
    ckpt_path = Path(config.get("ckpt_path", "models/anti_spoofing/effbetb0_softmax/efficientnet_b0_softmax_best.pt"))

    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    device_name = config.get("device", "")
    if not device_name:
        if torch.cuda.is_available():
            device_name = "cuda"
        elif torch.backends.mps.is_available():
            device_name = "mps"
        else:
            device_name = "cpu"
            
    device = torch.device(device_name)
    print(f"Testing on device: {device}")

    print("Loading checkpoint...")
    ckpt = torch.load(ckpt_path, map_location=device)
    classes = ckpt["classes"]
    num_classes = len(classes)
    
    # Khởi tạo mô hình và tải trọng số
    model = EfficientNetB0Classifier(num_classes=num_classes, pretrained=False).to(device)
    model.load_state_dict(ckpt["model_state"], strict=True)
    model.eval()
    
    print(f"Loaded model. Classes ({num_classes}): {classes}")

    print("Loading InsightFace...")
    app = FaceAnalysis(name=insightface_model, allowed_modules=['detection'])
    ctx_id = -1 if device_name == "cpu" else 0
    app.prepare(ctx_id=ctx_id, det_size=det_size)

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open camera index {camera_index}")

    print("Starting camera stream... Press 'q' to quit.")
    with torch.no_grad():
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            faces = app.get(frame)
            for face in faces:
                if float(face.det_score) < det_threshold:
                    continue
                
                # Căn chỉnh khuôn mặt bằng 5 điểm landmark
                aligned_crop = face_align.norm_crop(frame, landmark=face.kps, image_size=FACE_CROP_SIZE[0])
                if aligned_crop is None or aligned_crop.size == 0:
                    continue

                inp = preprocess_face(aligned_crop).to(device)
                
                # Dự đoán với Softmax
                logits = model(inp)
                probs = F.softmax(logits, dim=1)
                
                pred_idx = probs.argmax(dim=1).item()
                pred_prob = probs[0, pred_idx].item()
                pred_label = classes[pred_idx]
                
                text = f"{pred_label} ({pred_prob:.2f})"
                
                # Chọn màu: xanh lá cho Real/Selfies, đỏ cho Spoof
                if pred_label in ["Real", "Selfies"]:
                    color = (0, 200, 0)
                else:
                    color = (0, 0, 255)
                    
                draw_label(frame, face.bbox, text, color)

            cv2.imshow("Anti-spoofing Softmax Pipeline", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
