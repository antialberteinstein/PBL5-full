"""
Cấu hình hệ thống nhận diện khuôn mặt.

Có 2 chế độ tải model:
    USE_LOCAL_MODEL = False  →  InsightFace tự tải buffalo_l từ internet (~326MB)
    USE_LOCAL_MODEL = True   →  Tải từ LOCAL_MODEL_DIR trên máy (offline)
"""

from pathlib import Path

# ── Chế độ tải model ─────────────────────────────────────────────────────────────
# Đặt True để dùng model đã fine-tune trên máy, False để dùng buffalo_l online.
USE_LOCAL_MODEL: bool = False

# Đường dẫn thư mục chứa model trên máy khi USE_LOCAL_MODEL = True.
# Mặc định trỏ vào thư mục uriel đã được merge bởi merge_to_uriel.py.
_REPO_ROOT = Path(__file__).resolve().parents[2]
FINETUNED_MODEL_DIR: Path = _REPO_ROOT / "models" / "finetuned" / "uriel"
LOCAL_MODEL_DIR: Path = FINETUNED_MODEL_DIR

# Tên model pack (phải khớp với tên thư mục con bên trong LOCAL_MODEL_DIR).
# InsightFace sẽ tìm file theo cấu trúc: <LOCAL_MODEL_DIR>/<MODEL_PACK_NAME>/*.onnx
# Vì uriel/ chứa *.onnx trực tiếp (không có sub-folder), để tên trống ("").
LOCAL_MODEL_PACK: str = ""