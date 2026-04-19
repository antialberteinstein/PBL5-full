from __future__ import annotations

from pathlib import Path
import shutil
from typing import Iterable, Iterator

import cv2
import random
import numpy as np

try:
	from tqdm import tqdm
except ImportError:  # pragma: no cover
	tqdm = None




# Mapping folder gốc/subfolder đặc biệt sang label chuẩn
LABEL_MAP = {
	"3D_paper_mask": "3D_paper_mask",
	"Cutout_attacks": "Cutout_attack",
	"Latex_mask": "Latex_mask",
	"Replay_display_attacks/Screen": "Replay_display_attacks",
	"Replay_display_attacks/Real": "Real",
	"Replay_mobile_attacks": "Replay_mobile_attacks",
	"Selfies": "Selfies",
	"Silicone_mask": "Silicone_mask",
	"Textile 3D Face Mask Attack Sample": "Textile_3D_Face_Mask_Attack",
	"Wrapped_3D_paper_mask": "Wrapped_3D_paper_mask",
}
LABELS = list(set(LABEL_MAP.values()))

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv"}

# Extract frames from videos (in seconds). Use None for no end limit.
VIDEO_START_SEC = 0.0
VIDEO_END_SEC = None
FRAME_INTERVAL_SEC = 3.0

# Save extracted frames as JPEG to reduce size.
FRAME_IMAGE_EXT = ".jpg"
JPEG_QUALITY = 85


def is_media_file(path: Path) -> bool:
	return path.suffix.lower() in IMAGE_EXTS | VIDEO_EXTS


def nearest_leaf_dir(file_path: Path) -> Path:
	current = file_path.parent
	while True:
		has_subdir = any(p.is_dir() for p in current.iterdir())
		if not has_subdir:
			return current
		if current.parent == current:
			return current
		current = current.parent


def unique_path(dest_dir: Path, filename: str) -> Path:
	candidate = dest_dir / filename
	if not candidate.exists():
		return candidate
	stem = candidate.stem
	suffix = candidate.suffix
	for i in range(1, 10_000):
		candidate = dest_dir / f"{stem}_{i}{suffix}"
		if not candidate.exists():
			return candidate
	raise RuntimeError(f"Failed to create a unique path for {filename}")


def progress_iter(total: int | None, desc: str) -> Iterator[int]:
	if tqdm is None:
		if total is None:
			idx = 0
			while True:
				yield idx
				idx += 1
		else:
			for idx in range(total):
				yield idx
		return

	if total is None:
		pbar = tqdm(total=None, desc=desc, unit="frame")
		idx = 0
		try:
			while True:
				yield idx
				idx += 1
				pbar.update(1)
		finally:
			pbar.close()
		return

	with tqdm(total=total, desc=desc, unit="frame") as pbar:
		for idx in range(total):
			yield idx
			pbar.update(1)


def save_augmented_versions(img_bgr, base_dest_path: Path, label: str) -> int:
	if label == "Real":
		target_augs = 13
	elif label == "Selfies":
		target_augs = 6
	else:
		target_augs = 2
	
	stem = base_dest_path.stem
	suffix = base_dest_path.suffix
	parent = base_dest_path.parent
	
	saved_count = 0
	aug_types = ["blur", "heavy_blur", "bright", "dark", "contrast", "noise", "mix"]
	
	for i in range(target_augs):
		aug_type = aug_types[i % len(aug_types)]
		aug_img = None
		
		if aug_type == "blur":
			ksize = random.choice([5, 7])
			aug_img = cv2.GaussianBlur(img_bgr, (ksize, ksize), 0)
		elif aug_type == "heavy_blur":
			h_ksize = random.choice([15, 21, 25])
			aug_img = cv2.GaussianBlur(img_bgr, (h_ksize, h_ksize), 0)
		elif aug_type == "bright":
			aug_img = cv2.convertScaleAbs(img_bgr, alpha=1.0, beta=random.randint(50, 80))
		elif aug_type == "dark":
			aug_img = cv2.convertScaleAbs(img_bgr, alpha=1.0, beta=random.randint(-80, -50))
		elif aug_type == "contrast":
			alpha = random.uniform(0.6, 1.5)
			aug_img = cv2.convertScaleAbs(img_bgr, alpha=alpha, beta=0)
		elif aug_type == "noise":
			noise = np.random.normal(0, 15, img_bgr.shape).astype(np.uint8)
			aug_img = cv2.add(img_bgr, noise)
		elif aug_type == "mix":
			mix_ksize = random.choice([9, 11, 13])
			mix_alpha = random.uniform(0.6, 1.4)
			mix_beta = random.randint(-50, 50)
			aug_img = cv2.GaussianBlur(img_bgr, (mix_ksize, mix_ksize), 0)
			aug_img = cv2.convertScaleAbs(aug_img, alpha=mix_alpha, beta=mix_beta)
			
		dest = parent / f"{stem}__{aug_type}_{i}{suffix}"
		cv2.imwrite(str(dest), aug_img, [cv2.IMWRITE_JPEG_QUALITY, int(JPEG_QUALITY)])
		saved_count += 1
		
	return saved_count


def main():
	src_root = Path("dataset") / "anti-spoofing" / "AxonData"
	out_root = Path("dataset") / "anti-spoofing-rebuilt"

	# Tạo thư mục cho từng nhãn
	out_label_dirs = {}
	for label in LABELS:
		out_dir = out_root / label
		out_dir.mkdir(parents=True, exist_ok=True)
		out_label_dirs[label] = out_dir

	copied = 0
	label_counts = {label: 0 for label in LABELS}
	for path in src_root.rglob("*"):
		if not path.is_file() or not is_media_file(path):
			continue

		# Lấy relative path so với AxonData
		rel_path = path.relative_to(src_root)
		parts = rel_path.parts
		label = None
		
		part0 = parts[0].strip()

		# Xử lý mapping đặc biệt
		if part0 == "Replay_display_attacks" and len(parts) > 1:
			part1 = parts[1].strip()
			if part1 == "Screen":
				label = LABEL_MAP["Replay_display_attacks/Screen"]
			elif part1 == "Real":
				label = LABEL_MAP["Replay_display_attacks/Real"]
		elif part0 in LABEL_MAP:
			label = LABEL_MAP[part0]

		if label is None:
			print(f"Skip file with unknown label: {path}")
			continue
		dest_dir = out_label_dirs[label]

		if path.suffix.lower() in IMAGE_EXTS:
			filename = f"{label}__{path.name}"
			dest = unique_path(dest_dir, filename)
			shutil.copy2(path, dest)
			copied += 1
			label_counts[label] += 1
			
			img_bgr = cv2.imread(str(path))
			if img_bgr is not None:
				aug_count = save_augmented_versions(img_bgr, dest, label)
				copied += aug_count
				label_counts[label] += aug_count
					
			continue

		# Video: extract frames only, do not copy the video file.
		cap = cv2.VideoCapture(str(path))
		if not cap.isOpened():
			print(f"Skip unreadable video: {path}")
			cap.release()
			continue

		start_ms = max(0.0, VIDEO_START_SEC) * 1000.0
		end_ms = None if VIDEO_END_SEC is None else max(0.0, VIDEO_END_SEC) * 1000.0
		step_ms = max(0.1, FRAME_INTERVAL_SEC) * 1000.0

		fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
		frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
		if fps > 0 and frame_count > 0:
			video_ms = (frame_count / fps) * 1000.0
			if end_ms is None or end_ms > video_ms:
				end_ms = video_ms

		total_steps = None
		if end_ms is not None and end_ms >= start_ms:
			total_steps = int(((end_ms - start_ms) // step_ms) + 1)

		desc = f"Frames {path.name}"
		for idx in progress_iter(total_steps, desc):
			current_ms = start_ms + (idx * step_ms)
			if end_ms is not None and current_ms > end_ms:
				break
			cap.set(cv2.CAP_PROP_POS_MSEC, current_ms)
			ok, frame_bgr = cap.read()
			if not ok:
				break
			frame_name = f"{label}__{path.stem}__{int(current_ms)}ms{FRAME_IMAGE_EXT}"
			dest = unique_path(dest_dir, frame_name)
			cv2.imwrite(
				str(dest),
				frame_bgr,
				[cv2.IMWRITE_JPEG_QUALITY, int(JPEG_QUALITY)],
			)
			copied += 1
			label_counts[label] += 1
			
			aug_count = save_augmented_versions(frame_bgr, dest, label)
			copied += aug_count
			label_counts[label] += aug_count

		cap.release()

	print("\n" + "="*50)
	print("📊 THỐNG KÊ DATASET SAU KHI REBUILD")
	print("="*50)
	print(f"Tổng số label: {len(LABELS)}")
	print(f"Tổng số ảnh/frame thu được: {copied}")
	print("-" * 50)
	
	sorted_counts = sorted(label_counts.items(), key=lambda x: x[1], reverse=True)
	for l, c in sorted_counts:
		print(f"{l:<30}: {c:>6} mẫu")
	print("="*50 + "\n")

if __name__ == "__main__":
	main()
