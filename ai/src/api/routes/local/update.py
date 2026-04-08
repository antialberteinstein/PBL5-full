"""Update API endpoints (local UI)."""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from api.schemas import UpdateRequest
from api.bridges.ui.ui_runner import submit_task
from api.bridges.ui.ui_tasks import UITask, UITaskType

router = APIRouter(tags=["update"])


@router.post("/update")
def update_face(payload: UpdateRequest) -> Dict[str, Any]:
    """
    Update an existing face with new samples.

    Opens an OpenCV UI window on the main thread for interactive
    face updating. Blocks until the window closes.
    """
    task = UITask(
        task_type=UITaskType.UPDATE,
        params={"class_id": payload.class_id},
    )
    submit_task(task)

    task.done_event.wait()

    if task.error:
        raise HTTPException(status_code=500, detail=task.error)

    return task.result
