"""Pipeline initialization helpers for API services."""

from __future__ import annotations

from typing import Optional, Tuple

from logging_setup import setup_logging
from recog.face_recognition import InsightFaceDetector
from pipeline.recog import RecognitionPipeline
from pipeline.classify import ClassificationPipeline
from classify.preprocessing import PCAProcessor, ScalerProcessor
from classify.cosine_classifier import CosineClassifier


_recog_pipeline: Optional[RecognitionPipeline] = None
_classify_pipeline: Optional[ClassificationPipeline] = None


def _init_pipelines() -> Tuple[RecognitionPipeline, ClassificationPipeline]:
    setup_logging()

    recognizer = InsightFaceDetector()
    recognizer.prepare()
    recog_pipeline = RecognitionPipeline(recognizer)

    pca = PCAProcessor()
    scaler = ScalerProcessor()

    if not pca.load():
        raise RuntimeError("PCA model not found. Train or place models/pca_model.joblib.")
    if not scaler.load():
        raise RuntimeError("Scaler model not found. Train or place models/scaler_model.joblib.")

    classifier = CosineClassifier()
    classify_pipeline = ClassificationPipeline(pca, scaler, classifier)

    return recog_pipeline, classify_pipeline


def get_pipelines() -> Tuple[RecognitionPipeline, ClassificationPipeline]:
    global _recog_pipeline, _classify_pipeline

    if _recog_pipeline is None or _classify_pipeline is None:
        _recog_pipeline, _classify_pipeline = _init_pipelines()

    return _recog_pipeline, _classify_pipeline
