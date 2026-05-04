import os
import sys
import zipfile
import subprocess
import shutil

def install_and_import_gdown():
    try:
        import gdown
    except ImportError:
        print("Đang cài đặt thư viện 'gdown' để tải file từ Google Drive...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gdown"])
        import gdown
    return gdown

def download_and_extract(gdown, file_id, target_dir, zip_path):
    url = f'https://drive.google.com/uc?id={file_id}'
    zip_name = os.path.basename(zip_path)
    dir_name = os.path.basename(target_dir)
    
    if os.path.exists(target_dir) and os.path.isdir(target_dir) and len(os.listdir(target_dir)) > 0:
        print(f"✅ Thư mục {dir_name} đã tồn tại và không trống: {target_dir}")
        print(f"Bỏ qua quá trình tải {dir_name}.")
        return

    print(f"⬇️ Đang tải file {zip_name} từ Google Drive...")
    try:
        gdown.download(url, zip_path, quiet=False)
        if not os.path.exists(zip_path):
            raise Exception("File chưa được tải về")
        print(f"✅ Tải xong file {zip_name}!")
    except Exception as e:
        print(f"❌ Có lỗi xảy ra khi tải file {zip_name}: {e}")
        return

    print(f"📦 Đang giải nén {zip_name}...")
    try:
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(target_dir)
            
        # Xóa thư mục __MACOSX nếu có
        macosx_dir = os.path.join(target_dir, '__MACOSX')
        if os.path.exists(macosx_dir):
            shutil.rmtree(macosx_dir)
            
        print(f"✅ Giải nén thành công vào: {target_dir}")
    except zipfile.BadZipFile:
        print(f"❌ File ZIP bị lỗi. Có thể quá trình tải xuống bị gián đoạn hoặc bị chặn bởi cảnh báo diệt virus của Google Drive.")
    except Exception as e:
        print(f"❌ Có lỗi khi giải nén: {e}")

    # Xóa file zip sau khi giải nén
    if os.path.exists(zip_path):
        os.remove(zip_path)
        print(f"🗑️ Đã dọn dẹp file {zip_name}.")

def main():
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(tools_dir, '..'))
    
    # Thông tin dataset
    dataset_dir = os.path.join(root_dir, 'dataset')
    dataset_zip = os.path.join(root_dir, 'dataset.zip')
    dataset_id = '1rLX6Kotu9d_XqaE5MoAVCJrD0-hd1snd'
    
    # Thông tin models
    models_dir = os.path.join(root_dir, 'models')
    models_zip = os.path.join(root_dir, 'models.zip')
    models_id = '1rYkMV1JSC1duUwvn6VlpQMkQqccQUVrt'

    gdown = install_and_import_gdown()

    print("=" * 50)
    print("🚀 BẮT ĐẦU TẢI DỮ LIỆU (DATASET)")
    print("=" * 50)
    download_and_extract(gdown, dataset_id, dataset_dir, dataset_zip)
    
    print("\n" + "=" * 50)
    print("🚀 BẮT ĐẦU TẢI MODEL (MODELS)")
    print("=" * 50)
    download_and_extract(gdown, models_id, models_dir, models_zip)
    
    print("\n🎉 Hoàn tất quá trình thiết lập dữ liệu và model!")

if __name__ == "__main__":
    main()
