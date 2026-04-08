"""Register API endpoints (local UI)."""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from api.schemas import RegisterRequest
from api.bridges.ui.ui_runner import submit_task
from api.bridges.ui.ui_tasks import UITask, UITaskType

router = APIRouter(tags=["register"])


@router.post("/register")
def register_face(payload: RegisterRequest) -> Dict[str, Any]:
    """
    Register a new face.

    Opens an OpenCV UI window on the main thread for interactive
    face registration. Blocks until the window closes.
    """
    task = UITask(
        task_type=UITaskType.REGISTER,
        params={"class_id": payload.class_id},
    )
    submit_task(task)

    # Block the API thread until the UI runner finishes this task.
    task.done_event.wait()

    if task.error:
        raise HTTPException(status_code=500, detail=task.error)

    return task.result
