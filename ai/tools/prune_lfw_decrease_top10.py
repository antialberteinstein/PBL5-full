"""Keep only top-N labels (by image count) in lfw_decrease dataset."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}


def count_images(label_dir: Path) -> int:
    return sum(1 for p in label_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prune dataset to top-N labels")
    parser.add_argument(
        "--dataset",
        default="dataset/lfw_decrease",
        help="Path to dataset root (contains label subfolders)",
    )
    parser.add_argument("--keep", type=int, default=10, help="Number of labels to keep")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without deleting")
    args = parser.parse_args()

    root = Path(args.dataset)
    if not root.exists():
        raise SystemExit(f"Dataset not found: {root}")

    label_dirs = [p for p in root.iterdir() if p.is_dir()]
    label_counts = [(p, count_images(p)) for p in label_dirs]
    label_counts.sort(key=lambda x: x[1], reverse=True)

    keep = set(p for p, _ in label_counts[: args.keep])
    remove = [p for p, _ in label_counts[args.keep :]]

    print(f"Dataset: {root}")
    print(f"Total labels: {len(label_dirs)}")
    print(f"Keeping top {args.keep} labels:")
    for p, cnt in label_counts[: args.keep]:
        print(f"  {p.name}: {cnt}")

    if args.dry_run:
        print("\nDry run: labels to remove:")
        for p in remove:
            print(f"  {p.name}")
        return

    for p in remove:
        shutil.rmtree(p)

    print(f"\nRemoved {len(remove)} labels. Remaining: {len(keep)}")


if __name__ == "__main__":
    main()
