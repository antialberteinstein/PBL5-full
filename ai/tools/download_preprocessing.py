import os
import sys
import subprocess

def install_and_import_gdown():
    try:
        import gdown
    except ImportError:
        print("Đang cài đặt thư viện 'gdown' để tải file từ Google Drive...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gdown"])
        import gdown
    return gdown

def main():
    file_id = '1yVx1e_e-nopp7N1pxkWOeoIxvgUs8WLu'
    url = f'https://drive.google.com/uc?id={file_id}'
    
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(tools_dir, '..'))
    
    preprocessing_dir = os.path.join(root_dir, 'dataset', 'preprocessing')
    target_file = os.path.join(preprocessing_dir, 'lfw.npz')

    if not os.path.exists(preprocessing_dir):
        os.makedirs(preprocessing_dir)

    if os.path.exists(target_file):
        print(f"✅ File {os.path.basename(target_file)} đã tồn tại tại: {target_file}")
        print("Bỏ qua quá trình tải.")
        return

    gdown = install_and_import_gdown()

    print("=" * 50)
    print("🚀 BẮT ĐẦU TẢI DỮ LIỆU (PREPROCESSING LFW)")
    print("=" * 50)
    print(f"⬇️ Đang tải file lfw.npz từ Google Drive...")
    
    try:
        gdown.download(url, target_file, quiet=False)
        if not os.path.exists(target_file):
            raise Exception("File chưa được tải về")
        print(f"✅ Tải thành công file lfw.npz vào: {preprocessing_dir}")
    except Exception as e:
        print(f"❌ Có lỗi xảy ra khi tải file: {e}")
        return

    print("\n🎉 Hoàn tất quá trình tải dataset preprocessing!")

if __name__ == "__main__":
    main()
