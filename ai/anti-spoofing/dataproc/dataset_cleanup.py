from __future__ import annotations

from pathlib import Path
import shutil

# Keep only this dataset folder under dataset/.
KEEP_DIR = Path("dataset") / "anti-spoofing-rebuilt-cropped"
DATASET_ROOT = Path("dataset")


def main() -> None:
	if not DATASET_ROOT.exists():
		print(f"Dataset root not found: {DATASET_ROOT}")
		return

	keep_abs = KEEP_DIR.resolve()
	deleted = 0
	for path in DATASET_ROOT.iterdir():
		if not path.is_dir():
			continue
		if path.resolve() == keep_abs:
			continue
		shutil.rmtree(path)
		deleted += 1
		print(f"Deleted: {path}")

	print(f"Done. Deleted {deleted} folders. Kept: {KEEP_DIR}")


if __name__ == "__main__":
	main()
