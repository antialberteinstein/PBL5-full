"""Verify API endpoints (local UI)."""

import asyncio
import threading
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from api.bridges.ui.ui_runner import submit_task
from api.bridges.ui.ui_tasks import UITask, UITaskType

router = APIRouter(tags=["verify"])


@router.post("/verify")
def verify_face() -> Dict[str, Any]:
    """
    Verify faces in real-time.

    Opens an OpenCV UI window on the main thread for interactive
    face verification. Blocks until the window closes.
    """
    task = UITask(task_type=UITaskType.VERIFY)
    submit_task(task)

    task.done_event.wait()

    if task.error:
        raise HTTPException(status_code=500, detail=task.error)

    return task.result


@router.websocket("/ws/verify")
async def verify_face_ws(websocket: WebSocket) -> None:
    await websocket.accept()

    loop = asyncio.get_running_loop()
    stop_event = threading.Event()

    def on_match(class_id: str, score: float | None) -> None:
        payload = {
            "class_id": class_id,
            "score": score,
            "checkin_time": datetime.now().isoformat(timespec="seconds"),
        }
        asyncio.run_coroutine_threadsafe(websocket.send_json(payload), loop)

    task = UITask(
        task_type=UITaskType.VERIFY,
        params={"on_match": on_match, "stop_event": stop_event},
    )
    submit_task(task)

    try:
        await loop.run_in_executor(None, task.done_event.wait)
        await websocket.send_json({"status": "completed"})
    except WebSocketDisconnect:
        stop_event.set()
    finally:
        stop_event.set()
