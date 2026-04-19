from config.recog_config import USE_LOCAL_MODEL, LOCAL_MODEL_DIR, FINETUNED_MODEL_DIR, LOCAL_MODEL_PACK
from .face_recognition import FaceDetection, FaceRecognizer, InsightFaceDetector

__all__ = [
	"USE_LOCAL_MODEL",
	"LOCAL_MODEL_DIR",
	"FINETUNED_MODEL_DIR",
	"LOCAL_MODEL_PACK",
	"FaceDetection",
	"FaceRecognizer",
	"InsightFaceDetector",
]
