"""Shared helpers for streaming WebSocket endpoints."""

from typing import Any, Dict, Optional

import cv2
import numpy as np


def decode_frame(frame_bytes: bytes) -> Optional[np.ndarray]:
    frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
    if frame_array.size == 0:
        return None
    return cv2.imdecode(frame_array, cv2.IMREAD_COLOR)


def progress_payload(
    total_collected: int,
    total_required: int,
    req_pose: Optional[str],
    pose_collected: int,
    pose_required: int,
) -> Dict[str, Any]:
    return {
        "progress_total": {
            "collected": total_collected,
            "required": total_required,
        },
        "progress_pose": {
            "pose": req_pose,
            "collected": pose_collected,
            "required": pose_required,
        },
    }


def _to_list(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return value.tolist()
    return value


def serialize_face_result(face: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "bbox": _to_list(face.get("bbox")),
        "class_id": face.get("class_id"),
        "score": face.get("score"),
        "pose": _to_list(face.get("pose")),
        "pose_name": face.get("pose_name"),
        "is_known": face.get("is_known"),
        "landmarks": _to_list(face.get("landmarks")),
    }
