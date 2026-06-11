import shutil
import os
from pathlib import Path

# ── Đường dẫn gốc ──────────────────────────────────────────────────────────
FINETUNE_ROOT = Path(__file__).resolve().parents[1]
MERGED_DIR = FINETUNE_ROOT / "models" / "merged"
SOURCE_DIR = MERGED_DIR / "uriel"
OUTPUT_DIR = FINETUNE_ROOT / "models" / "prepare-to-upload"
OUTPUT_ZIP = OUTPUT_DIR / "uriel"  # shutil sẽ tự thêm .zip

def package_model():
    print("\n" + "=" * 55)
    print("  PACKAGING MODEL FOR GITHUB RELEASE")
    print("=" * 55)

    # ── Kiểm tra thư mục nguồn ──────────────────────────────────────────────
    if not SOURCE_DIR.exists():
        print(f"\n[ERROR] Không tìm thấy thư mục: {SOURCE_DIR}")
        print("        Hãy chạy merge_to_uriel.py trước!")
        return

    # ── Xóa file zip cũ nếu có ──────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    zip_file = Path(str(OUTPUT_ZIP) + ".zip")
    if zip_file.exists():
        print(f"\n[1/2] Xóa file zip cũ: {zip_file.name}")
        zip_file.unlink()
    else:
        print("\n[1/2] Chuẩn bị đóng gói...")

    # ── Đóng gói ────────────────────────────────────────────────────────────
    print(f"[2/2] Đang nén thư mục: {SOURCE_DIR.name}/ → {zip_file.name}")
    try:
        # base_name: tên file zip (không đuôi)
        # format: zip
        # root_dir: thư mục cha của thư mục cần nén
        # base_dir: tên thư mục cần nén (sẽ là folder gốc trong zip)
        shutil.make_archive(
            base_name=str(OUTPUT_ZIP),
            format='zip',
            root_dir=str(MERGED_DIR),
            base_dir=SOURCE_DIR.name
        )
        
        print("\n" + "=" * 55)
        print("  ✅ ĐÓNG GÓI HOÀN TẤT!")
        print(f"  File: {zip_file}")
        print(f"  Size: {zip_file.stat().st_size // (1024 * 1024)} MB")
        print("=" * 55 + "\n")
        print("  🚀 Bạn có thể upload file này lên GitHub Release ngay bây giờ.")
        
    except Exception as e:
        print(f"\n[ERROR] Lỗi khi đóng gói: {e}")

if __name__ == "__main__":
    package_model()
