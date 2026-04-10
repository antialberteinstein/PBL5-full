"""
Main-thread UI runner for OpenCV windows.

On macOS, cv2.imshow/cv2.waitKey MUST run on the main thread.
API handlers submit UI tasks to a queue; this runner consumes them
on the main thread so OpenCV works correctly.
"""

from __future__ import annotations

import logging
import queue
from typing import Any

from api.bridges.ui.ui_tasks import UITask, UITaskType


# Singleton queue shared between the API thread and the main thread.
_task_queue: queue.Queue[UITask] = queue.Queue(maxsize=1)


def submit_task(task: UITask) -> None:
    """Submit a UI task (called from the API/uvicorn thread)."""
    _task_queue.put(task)


def run_ui_loop(
    registration_recog_pipeline: Any,
    verification_recog_pipeline: Any,
    classify_pipeline: Any,
    camera: Any,
) -> None:
    """
    Blocking loop that runs on the **main thread**.
    Waits for UITask items from the queue and executes them
    with the corresponding UI class.
    """
    from ui.registration_ui import RegistrationUI
    from ui.update_face_ui import UpdateFaceUI
    from ui.verification_ui import VerificationUI

    logging.info("UI runner started on main thread — waiting for tasks …")

    while True:
        try:
            task: UITask = _task_queue.get(timeout=0.5)
        except queue.Empty:
            continue

        logging.info("UI runner received task: %s", task.task_type.name)

        try:
            if task.task_type == UITaskType.REGISTER:
                ui = RegistrationUI(registration_recog_pipeline, classify_pipeline)
                ui.run(task.params["class_id"], camera)

                task.result = {
                    "status": "completed" if ui.service.is_complete else "incomplete",
                    "class_id": task.params["class_id"],
                    "total_collected": ui.service.total_collected,
                    "max_required": ui.service.max_registration_images,
                }

            elif task.task_type == UITaskType.UPDATE:
                ui = UpdateFaceUI(registration_recog_pipeline, classify_pipeline)
                ui.run(task.params["class_id"], camera)

                task.result = {
                    "status": "completed" if ui.service.is_complete else "incomplete",
                    "class_id": task.params["class_id"],
                    "total_collected": ui.service.total_collected_session,
                    "max_required": ui.service.max_update_images,
                }

            elif task.task_type == UITaskType.VERIFY:
                ui = VerificationUI(
                    verification_recog_pipeline,
                    classify_pipeline,
                    on_match=task.params.get("on_match"),
                    on_frame=task.params.get("on_frame"),
                    stop_event=task.params.get("stop_event"),
                )
                ui.run(camera, show_ui=task.params.get("show_ui", True))

                task.result = {
                    "status": "completed",
                }

        except Exception as exc:
            logging.exception("UI task failed: %s", exc)
            task.error = str(exc)

        finally:
            task.done_event.set()
            _task_queue.task_done()
