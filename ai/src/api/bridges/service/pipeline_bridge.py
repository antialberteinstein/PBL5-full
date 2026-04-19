"""Pipeline initialization helpers for API services."""

from __future__ import annotations

from typing import Optional, Tuple

from logging_setup import setup_logging
from recog.face_recognition import InsightFaceDetector
from pipeline.recog import RecognitionPipeline
from pipeline.classify import ClassificationPipeline
from classify.preprocessing import PCAProcessor, ScalerProcessor
from classify.cosine_classifier import CosineClassifier
from config.api_service_config import DEVICE, VERIFY_ALLOWED_MODULES


_recog_pipeline_register: Optional[RecognitionPipeline] = None
_recog_pipeline_verify: Optional[RecognitionPipeline] = None
_classify_pipeline: Optional[ClassificationPipeline] = None


def _init_classify_pipeline() -> ClassificationPipeline:
    pca = PCAProcessor()
    scaler = ScalerProcessor()

    if not pca.load():
        raise RuntimeError("PCA model not found. Train or place models/pca_model.joblib.")
    if not scaler.load():
        raise RuntimeError("Scaler model not found. Train or place models/scaler_model.joblib.")

    classifier = CosineClassifier()
    return ClassificationPipeline(pca, scaler, classifier)


def _init_registration_recog_pipeline() -> RecognitionPipeline:
    recognizer = InsightFaceDetector(device=DEVICE)
    recognizer.prepare()
    return RecognitionPipeline(
        recognizer,
        include_pose=True,
        include_landmarks=True,
    )


def _init_verification_recog_pipeline() -> RecognitionPipeline:
    recognizer = InsightFaceDetector(device=DEVICE, allowed_modules=VERIFY_ALLOWED_MODULES)
    recognizer.prepare()
    return RecognitionPipeline(
        recognizer,
        include_pose=False,
        include_landmarks=False,
    )


def get_registration_pipelines() -> Tuple[RecognitionPipeline, ClassificationPipeline]:
    global _recog_pipeline_register, _classify_pipeline

    setup_logging()
    if _recog_pipeline_register is None:
        _recog_pipeline_register = _init_registration_recog_pipeline()
    if _classify_pipeline is None:
        _classify_pipeline = _init_classify_pipeline()

    return _recog_pipeline_register, _classify_pipeline


def get_verification_pipelines() -> Tuple[RecognitionPipeline, ClassificationPipeline]:
    global _recog_pipeline_verify, _classify_pipeline

    setup_logging()
    if _recog_pipeline_verify is None:
        _recog_pipeline_verify = _init_verification_recog_pipeline()
    if _classify_pipeline is None:
        _classify_pipeline = _init_classify_pipeline()

    return _recog_pipeline_verify, _classify_pipeline
