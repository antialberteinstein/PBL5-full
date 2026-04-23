from __future__ import annotations

from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from insightface.app import FaceAnalysis
from insightface.utils import face_align
import sys

# Thêm thư mục gốc (anti-spoofing) vào sys.path để import được config chung
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
	sys.path.insert(0, str(root_dir))

from config import FACE_CROP_SIZE, FACE_PAD_RATIO

# Input dataset (already rebuilt into real/spoof folders).
INPUT_DIR = Path("dataset") / "anti-spoofing-rebuilt"
# Output folder for cropped + resized faces.
OUTPUT_DIR = Path("dataset") / "anti-spoofing-rebuilt-cropped"


# InsightFace settings.
MODEL_NAME = "buffalo_l"
DET_SIZE = (640, 640)
DET_THRESHOLD = 0.5
DEVICE = "cpu"  # use "cuda" if available

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
SKIP_LABELS = {"Latex_mask", "Silicone_mask"}


def iter_images(root: Path) -> Iterable[Path]:
	for path in root.rglob("*"):
		if path.is_file() and path.suffix.lower() in IMAGE_EXTS:
			yield path


def pick_largest_face(faces) -> object | None:
	if not faces:
		return None
	return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def crop_face(image: np.ndarray, bbox: np.ndarray, pad_ratio: float = FACE_PAD_RATIO) -> np.ndarray:
	h, w = image.shape[:2]
	x1, y1, x2, y2 = bbox.astype(int)
	
	# Tính toán padding dựa trên tỷ lệ kích thước khuôn mặt
	box_w = x2 - x1
	box_h = y2 - y1
	pad_x = int(box_w * pad_ratio)
	pad_y = int(box_h * pad_ratio)
	
	# Mở rộng bounding box
	x1 = max(0, x1 - pad_x)
	y1 = max(0, y1 - pad_y)
	x2 = min(w - 1, x2 + pad_x)
	y2 = min(h - 1, y2 + pad_y)
	
	return image[y1:y2, x1:x2]


def main() -> None:
	# Chỉ khởi tạo module face detection (SCRFD) thay vì toàn bộ pipeline để tăng tốc độ
	app = FaceAnalysis(name=MODEL_NAME, allowed_modules=['detection'])
	ctx_id = -1 if DEVICE == "cpu" else 0
	app.prepare(ctx_id=ctx_id, det_size=DET_SIZE)

	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

	processed = 0
	skipped = 0
	for img_path in iter_images(INPUT_DIR):
		rel = img_path.relative_to(INPUT_DIR)
		
		# Bỏ qua các label không mong muốn
		if rel.parts[0] in SKIP_LABELS:
			continue

		out_path = OUTPUT_DIR / rel
		out_path.parent.mkdir(parents=True, exist_ok=True)

		image = cv2.imread(str(img_path))
		if image is None:
			skipped += 1
			continue

		faces = app.get(image)
		face = pick_largest_face(faces)
		if face is None or face.det_score < DET_THRESHOLD:
			skipped += 1
			continue

		# Sử dụng face-alignment của InsightFace để căn chỉnh khuôn mặt dựa trên 5 điểm landmarks (kps)
		aligned_crop = face_align.norm_crop(image, landmark=face.kps, image_size=FACE_CROP_SIZE[0])
		if aligned_crop is None or aligned_crop.size == 0:
			skipped += 1
			continue

		cv2.imwrite(str(out_path), aligned_crop)
		processed += 1

	print(f"Processed: {processed}, Skipped: {skipped}")
	print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
	main()
