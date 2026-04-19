"""
Merge Script: Kết hợp backbone ONNX đã fine-tune với các module hỗ trợ
vào thư mục models/finetuned/uriel/ của hệ thống chính.

Quy trình:
    1. Copy các ONNX hỗ trợ từ thư mục without_backbone vào uriel/.
    2. Copy backbone ONNX đã fine-tune vào uriel/ với tên InsightFace nhận ra.

Yêu cầu: train.py phải đã chạy xong và xuất ra file ONNX trước.
"""

import sys
import shutil
import argparse
from pathlib import Path


# ── Đường dẫn gốc ──────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[2]
FINETUNE_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_ONNX = FINETUNE_ROOT / "models" / "finetuned" / "r50_lora_finetuned.onnx"
DEFAULT_WITHOUT_BACKBONE_DIR = REPO_ROOT / "models" / "without_backbone"
DEFAULT_URIEL_DIR = REPO_ROOT / "models" / "finetuned" / "uriel"

# InsightFace nhận dạng file recognition theo tên này
RECOGNITION_ONNX_NAME = "w600k_r50.onnx"


def sync_support_files(src_dir: Path, dst_dir: Path) -> None:
    """Copy toàn bộ ONNX hỗ trợ (detection, alignment, genderage) vào uriel/."""
    dst_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for f in src_dir.glob("*.onnx"):
        shutil.copy2(f, dst_dir / f.name)
        print(f"  Copied: {f.name}")
        copied += 1
    if copied == 0:
        print(f"  [WARN] Không tìm thấy ONNX nào trong {src_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge finetuned backbone vào thư mục uriel")
    parser.add_argument(
        "--onnx",
        type=Path,
        default=DEFAULT_ONNX,
        help=f"Đường dẫn tới file ONNX đã fine-tune (mặc định: {DEFAULT_ONNX})",
    )
    parser.add_argument(
        "--without_backbone_dir",
        type=Path,
        default=DEFAULT_WITHOUT_BACKBONE_DIR,
        help="Thư mục chứa các ONNX hỗ trợ (detection, alignment...)",
    )
    parser.add_argument(
        "--uriel_dir",
        type=Path,
        default=DEFAULT_URIEL_DIR,
        help=f"Thư mục đích để merge vào (mặc định: {DEFAULT_URIEL_DIR})",
    )
    args = parser.parse_args()

    print("\n" + "=" * 55)
    print("  MERGE FINETUNED BACKBONE → URIEL")
    print("=" * 55)

    # ── Kiểm tra file ONNX đầu vào ─────────────────────────────────────────
    if not args.onnx.exists():
        print(f"\n[ERROR] Không tìm thấy file ONNX: {args.onnx}")
        print("        Hãy chạy train.py trước để xuất file ONNX!")
        sys.exit(1)

    if not args.without_backbone_dir.exists():
        print(f"\n[ERROR] Không tìm thấy thư mục: {args.without_backbone_dir}")
        sys.exit(1)

    # ── Bước 1: Copy các ONNX hỗ trợ vào uriel/ ───────────────────────────
    print(f"\n[1/2] Sync support files: {args.without_backbone_dir.name}/ → uriel/")
    sync_support_files(args.without_backbone_dir, args.uriel_dir)

    # ── Bước 2: Copy backbone ONNX vào uriel/ với tên InsightFace nhận ra ──
    dest = args.uriel_dir / RECOGNITION_ONNX_NAME
    print(f"\n[2/2] Copy backbone: {args.onnx.name} → {RECOGNITION_ONNX_NAME}")
    shutil.copy2(args.onnx, dest)
    print(f"  Done  ({dest.stat().st_size // 1024} KB)")

    # ── Tổng kết ──────────────────────────────────────────────────────────
    print("\n" + "=" * 55)
    print("  ✅ MERGE HOÀN TẤT!")
    print(f"  Thư mục uriel: {args.uriel_dir}")
    for f in sorted(args.uriel_dir.glob("*.onnx")):
        print(f"    {f.name:<35} {f.stat().st_size // 1024:>6} KB")
    print("=" * 55 + "\n")


if __name__ == "__main__":
    main()
