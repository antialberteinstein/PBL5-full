"""Verify API endpoint with local camera streaming frames to client."""

import asyncio
import base64
import threading
from datetime import datetime
from typing import Any, Dict, List

import cv2
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.bridges.ui.ui_runner import submit_task
from api.bridges.ui.ui_tasks import UITask, UITaskType

router = APIRouter(tags=["verify"])


def _serialize_faces(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized = []
    for res in results:
        bbox = res.get("bbox")
        pose = res.get("pose")
        landmarks = res.get("landmarks")
        serialized.append(
            {
                "bbox": bbox.tolist() if hasattr(bbox, "tolist") else bbox,
                "class_id": res.get("class_id"),
                "score": res.get("score"),
                "pose": pose.tolist() if hasattr(pose, "tolist") else pose,
                "pose_name": res.get("pose_name"),
                "is_known": res.get("is_known"),
                "landmarks": landmarks.tolist() if hasattr(landmarks, "tolist") else landmarks,
            }
        )
    return serialized


@router.websocket("/ws/verify_stream_local")
async def verify_stream_local(websocket: WebSocket) -> None:
    await websocket.accept()

    loop = asyncio.get_running_loop()
    stop_event = threading.Event()
    frame_id = 0

    async def _send_frame(payload: Dict[str, Any], frame_bytes: bytes) -> None:
        await websocket.send_json(payload)
        await websocket.send_bytes(frame_bytes)

    def on_frame(frame, results) -> None:
        nonlocal frame_id
        try:
            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if not ok:
                return
            frame_id += 1
            payload = {
                "type": "frame",
                "frame_id": frame_id,
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "faces": _serialize_faces(results),
            }
            asyncio.run_coroutine_threadsafe(_send_frame(payload, buf.tobytes()), loop)
        except Exception:
            stop_event.set()

    task = UITask(
        task_type=UITaskType.VERIFY,
        params={"on_frame": on_frame, "stop_event": stop_event, "show_ui": False},
    )
    submit_task(task)

    try:
        await loop.run_in_executor(None, task.done_event.wait)
        await websocket.send_json({"status": "completed"})
    except WebSocketDisconnect:
        stop_event.set()
    finally:
        stop_event.set()
