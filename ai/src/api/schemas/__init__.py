"""Pydantic request/response schemas for API endpoints."""

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    class_id: str = Field(..., min_length=1)


class UpdateRequest(BaseModel):
    class_id: str = Field(..., min_length=1)
