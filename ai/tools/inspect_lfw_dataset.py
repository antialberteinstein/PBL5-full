"""Inspect LFW-style dataset statistics.

Reports per-label image counts and distribution (labels with 1 image, 2 images, ...).
"""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}


def count_images(label_dir: Path) -> int:
    return sum(1 for p in label_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS and p.is_file())


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect dataset label image counts")
    parser.add_argument(
        "--dataset",
        default="dataset/lfw_decrease",
        help="Path to dataset root (contains label subfolders)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        help="Show top-N labels with most images",
    )
    args = parser.parse_args()

    root = Path(args.dataset)
    if not root.exists():
        raise SystemExit(f"Dataset not found: {root}")

    label_counts: dict[str, int] = {}
    for label_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        label_counts[label_dir.name] = count_images(label_dir)

    total_labels = len(label_counts)
    total_images = sum(label_counts.values())

    dist = Counter(label_counts.values())
    low_sample_labels = [name for name, count in label_counts.items() if count < 5]

    print(f"Dataset: {root}")
    print(f"Total labels: {total_labels}")
    print(f"Total images: {total_images}")
    print(f"Labels with < 5 images: {len(low_sample_labels)}")
    print("\nDistribution (images per label):")
    for count in sorted(dist):
        print(f"  {count}: {dist[count]}")

    if args.top > 0:
        print(f"\nTop {args.top} labels by image count:")
        top_items = sorted(label_counts.items(), key=lambda x: x[1], reverse=True)[: args.top]
        for name, count in top_items:
            print(f"  {name}: {count}")


if __name__ == "__main__":
    main()
