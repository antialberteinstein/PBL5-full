"""Streaming WebSocket endpoint for registration without UI."""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.bridges.service.service_bridge import get_registration_service
from api.routes.stream.common import decode_frame, progress_payload

router = APIRouter(tags=["streaming"])


@router.websocket("/ws/register_stream")
async def register_stream(
    websocket: WebSocket,
    student_id: str,
    reregister: bool = False,
) -> None:
    await websocket.accept()

    service = get_registration_service()
    if reregister:
        # Wipe previous embeddings so the student can register a fresh face.
        try:
            service.classify_pipeline.delete_student(student_id)
            logging.info("[register_stream] re-register: cleared old embeddings for %s", student_id)
        except Exception as exc:
            logging.error("[register_stream] re-register cleanup failed for %s: %s", student_id, exc)
    last_status = None
    last_pose = None
    loop = asyncio.get_running_loop()

    # Shared slot holding only the most recent frame bytes. The receiver task
    # overwrites it as fast as frames arrive; the processor always picks the
    # freshest one, so stale frames are dropped when CPU lags behind.
    latest_frame_bytes: dict = {"data": None}
    frame_event = asyncio.Event()
    stop_event = asyncio.Event()

    def _process_frame(frame):
        detections = service.detect_faces(frame)
        main_face = detections[0] if detections else None
        req_pose = service.current_pose
        det_pose = None
        db_id = None
        status = "NO_FACE"
        bbox = None

        if main_face is not None:
            bbox = main_face.bbox.tolist() if getattr(main_face, "bbox", None) is not None else None
            det_pose = getattr(main_face, "pose_name", None)
            # In re-register mode the user has explicitly asked to overwrite their
            # face, and we've already wiped their previous embeddings at WS connect.
            # Skip the duplicate check so false positives against other students
            # (cosine similarity > threshold) can't block the flow.
            db_id = None if reregister else service.check_already_registered(main_face.embedding)

            if db_id:
                status = "ALREADY_REGISTERED"
            else:
                res = service.process_face_sample(student_id, frame, main_face)
                status = res.get("status", "UNKNOWN")
                req_pose = res.get("req_pose")
                det_pose = res.get("det_pose")

        if service.is_complete:
            service.save(student_id)
            status = "COMPLETE"

        pose_count = service.get_pose_count(req_pose) if req_pose else 0
        payload = {
            "status": status,
            "student_id": student_id,
            "det_pose": det_pose,
            "req_pose": req_pose,
            "db_id": db_id,
            "bbox": bbox,
            "progress_text": f"{service.total_collected}/{service.max_registration_images}",
        }
        payload.update(
            progress_payload(
                total_collected=service.total_collected,
                total_required=service.max_registration_images,
                req_pose=req_pose,
                pose_collected=pose_count,
                pose_required=service.images_per_pose,
            )
        )
        return payload, status, req_pose

    async def _receiver():
        try:
            while not stop_event.is_set():
                message = await websocket.receive()
                frame_bytes = message.get("bytes")
                if frame_bytes is None:
                    continue
                # Overwrite — any unprocessed older frame is intentionally dropped.
                latest_frame_bytes["data"] = frame_bytes
                frame_event.set()
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            stop_event.set()
            frame_event.set()

    receiver_task = asyncio.create_task(_receiver())

    try:
        while not stop_event.is_set():
            await frame_event.wait()
            frame_event.clear()
            frame_bytes = latest_frame_bytes["data"]
            latest_frame_bytes["data"] = None
            if frame_bytes is None:
                continue

            frame = decode_frame(frame_bytes)
            if frame is None:
                try:
                    await websocket.send_json({"status": "BAD_FRAME"})
                except (WebSocketDisconnect, RuntimeError):
                    break
                continue

            payload, status, req_pose = await loop.run_in_executor(None, _process_frame, frame)

            if status != last_status or req_pose != last_pose:
                logging.info(
                    "[register_stream] student_id=%s status=%s pose=%s collected=%s/%s",
                    student_id,
                    status,
                    req_pose,
                    service.total_collected,
                    service.max_registration_images,
                )
                last_status = status
                last_pose = req_pose

            try:
                await websocket.send_json(payload)
            except (WebSocketDisconnect, RuntimeError):
                break
    except WebSocketDisconnect:
        pass
    finally:
        stop_event.set()
        receiver_task.cancel()
        try:
            await receiver_task
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass
