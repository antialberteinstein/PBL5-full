from config.recog_config import MODEL_NAME, CUSTOM_MODEL_URL
from .face_recognition import FaceDetection, FaceRecognizer, InsightFaceDetector

__all__ = [
	"MODEL_NAME",
	"CUSTOM_MODEL_URL",
	"FaceDetection",
	"FaceRecognizer",
	"InsightFaceDetector",
]
