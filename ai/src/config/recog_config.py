"""
Cấu hình hệ thống nhận diện khuôn mặt.
Tự động tải model từ Custom URL (GitHub Releases).
"""

BUFFALO_L = ('buffalo_l', 'https://github.com/deepinsight/insightface/releases/download/v0.7')
URIEL = ('uriel', "https://github.com/antialberteinstein/PBL5-full/releases/download/v0.1.0")

# Chọn model ở đây (BUFFALO_L hoặc URIEL)
MODEL_NAME, CUSTOM_MODEL_URL = BUFFALO_L