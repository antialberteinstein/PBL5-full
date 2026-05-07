"""Verify API endpoint with local camera streaming frames to client."""

import asyncio
import base64
import json
import logging
import threading
import time
from datetime import datetime
from typing import Any, Dict, List

import cv2
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.bridges.ui.ui_runner import submit_task
from api.bridges.ui.ui_tasks import UITask, UITaskType
from api.bridges.lcd.lcd_bridge import send_to_lcd

router = APIRouter(tags=["verify"])


def _serialize_faces(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized = []
    for res in results:
        bbox = res.get("bbox")
        serialized.append(
            {
                "bbox": bbox.tolist() if hasattr(bbox, "tolist") else bbox,
                "student_id": res.get("student_id"),
                "score": res.get("score"),
                "is_known": res.get("is_known"),
                "is_real": res.get("is_real"),
                "antispoof_score": res.get("antispoof_score"),
            }
        )
    return serialized


def _draw_faces(frame, results: List[Dict[str, Any]]) -> None:
    for res in results:
        bbox = res.get("bbox")
        if bbox is None:
            continue
        box = bbox.astype(int) if hasattr(bbox, "astype") else [int(v) for v in bbox]
        is_known = bool(res.get("is_known"))
        color = (0, 200, 0) if is_known else (0, 0, 255)

        cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), color, 2)

        score = res.get("score")
        score_text = "N/A" if score is None else f"{score:.2f}" if score != float("inf") else "inf"
        label = f"{res.get('student_id')}: {score_text}" if is_known else f"UNKNOWN: {score_text}"
        cv2.putText(frame, label, (box[0], box[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        if "is_real" in res:
            is_real = bool(res.get("is_real"))
            liveness_color = (0, 200, 0) if is_real else (0, 0, 255)
            liveness_score = res.get("antispoof_score")
            liveness_text = "REAL" if is_real else "SPOOF"
            if liveness_score is None:
                liveness_suffix = "N/A"
            else:
                liveness_suffix = f"{liveness_score:.2f}"
            cv2.putText(
                frame,
                f"Liveness: {liveness_text} ({liveness_suffix})",
                (box[0], box[3] + 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                liveness_color,
                2,
            )


def _encode_image_url(frame) -> str | None:
    try:
        ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ok:
            return None
        return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
    except Exception:
        return None


def _draw_success_notice(frame, student_id: str, score: float | None) -> None:
    score_text = "" if score is None else f" ({score:.2f})"
    message = f"Check-in success: {student_id}{score_text}"
    _, width = frame.shape[:2]
    padding = 16
    box_height = 54

    cv2.rectangle(frame, (0, 0), (width, box_height), (0, 150, 0), -1)
    cv2.putText(
        frame,
        message,
        (padding, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.85,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )


@router.websocket("/ws/verify_stream_local")
async def verify_stream_local(websocket: WebSocket) -> None:
    await websocket.accept()

    loop = asyncio.get_running_loop()
    stop_event = threading.Event()
    frame_id = 0
    ack_timeout_sec = 5.0
    ack_state = {
        "last_ack_ts": time.monotonic(),
        "last_sent_frame_id": 0,
    }
    allowed_student_ids_ref = {
        "values": ["????"],
        "lock": threading.Lock(),
    }

    async def _send_frame(payload: Dict[str, Any], frame_bytes: bytes) -> None:
        await websocket.send_json(payload)
        await websocket.send_bytes(frame_bytes)

    def on_frame(frame, results) -> None:
        nonlocal frame_id
        nonlocal ack_state
        try:
            annotated = frame.copy()
            _draw_faces(annotated, results)
            ok, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if not ok:
                return
            frame_id += 1
            ack_state["last_sent_frame_id"] = frame_id
            payload = {
                "type": "frame",
                "frame_id": frame_id,
                "timestamp": datetime.now().isoformat(timespec="seconds"),
            }
            asyncio.run_coroutine_threadsafe(_send_frame(payload, buf.tobytes()), loop)
        except Exception:
            stop_event.set()

    def on_match(student_id: str, score: float | None, frame=None) -> None:
        success_frame = None
        if frame is not None:
            success_frame = frame.copy()
            _draw_success_notice(success_frame, student_id, score)
        image_url = _encode_image_url(success_frame) if success_frame is not None else None
        payload = {
            "type": "match",
            "student_id": student_id,
            "score": score,
            "checkin_time": datetime.now().isoformat(timespec="seconds"),
            "image_url": image_url,
        }
        asyncio.run_coroutine_threadsafe(websocket.send_json(payload), loop)
        send_to_lcd(student_id)

    async def _watch_client() -> None:
        try:
            while True:
                message = await websocket.receive()
                text = message.get("text")
                if not text:
                    continue
                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    continue

                if data.get("type") == "ok":
                    if data.get("frame_id") == ack_state["last_sent_frame_id"]:
                        ack_state["last_ack_ts"] = time.monotonic()
                elif data.get("type") == "allowlist":
                    student_ids = data.get("student_ids") or []
                    if not isinstance(student_ids, list):
                        continue
                    if not student_ids:
                        student_ids = ["????"]
                        logging.info(
                            "[verify_stream_local] received empty allowlist; using dummy allowlist=%s",
                            student_ids,
                        )
                    with allowed_student_ids_ref["lock"]:
                        allowed_student_ids_ref["values"] = [str(val) for val in student_ids]
                elif data.get("type") == "stop":
                    stop_event.set()
        except (WebSocketDisconnect, RuntimeError):
            stop_event.set()

    async def _monitor_ack() -> None:
        while not stop_event.is_set():
            await asyncio.sleep(0.5)
            if time.monotonic() - ack_state["last_ack_ts"] > ack_timeout_sec:
                stop_event.set()
                return

    task = UITask(
        task_type=UITaskType.VERIFY,
        params={
            "on_frame": on_frame,
            "on_match": on_match,
            "stop_event": stop_event,
            "show_ui": False,
            "allowed_student_ids_ref": allowed_student_ids_ref,
        },
    )
    submit_task(task)

    try:
        disconnect_task = asyncio.create_task(_watch_client())
        ack_task = asyncio.create_task(_monitor_ack())
        await loop.run_in_executor(None, task.done_event.wait)
        await websocket.send_json({"status": "completed"})
    except WebSocketDisconnect:
        stop_event.set()
    finally:
        stop_event.set()
        if "disconnect_task" in locals():
            disconnect_task.cancel()
        if "ack_task" in locals():
            ack_task.cancel()
