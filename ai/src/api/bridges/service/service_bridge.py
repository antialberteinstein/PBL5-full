"""Helpers to build services with injected pipelines."""

from __future__ import annotations

from services.registration_service import RegistrationService
from services.update_face_service import UpdateFaceService
from services.verification_service import VerificationService
from api.bridges.service.pipeline_bridge import get_pipelines


def get_registration_service() -> RegistrationService:
    recog_pipeline, classify_pipeline = get_pipelines()
    return RegistrationService(recog_pipeline, classify_pipeline)


def get_update_service() -> UpdateFaceService:
    recog_pipeline, classify_pipeline = get_pipelines()
    return UpdateFaceService(recog_pipeline, classify_pipeline)


def get_verification_service() -> VerificationService:
    recog_pipeline, classify_pipeline = get_pipelines()
    return VerificationService(recog_pipeline, classify_pipeline)
