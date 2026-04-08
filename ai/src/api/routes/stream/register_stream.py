"""Streaming WebSocket endpoint for registration without UI."""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.bridges.service.service_bridge import get_registration_service
from api.routes.stream.common import decode_frame, progress_payload

router = APIRouter(tags=["streaming"])


@router.websocket("/ws/register_stream")
async def register_stream(websocket: WebSocket, class_id: str) -> None:
    await websocket.accept()

    service = get_registration_service()

    try:
        while True:
            message = await websocket.receive()
            frame_bytes = message.get("bytes")
            if frame_bytes is None:
                await asyncio.sleep(0)
                continue

            frame = decode_frame(frame_bytes)
            if frame is None:
                await websocket.send_json({"status": "BAD_FRAME"})
                continue

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
                db_id = service.check_already_registered(frame, main_face.bbox)

                if db_id:
                    status = "ALREADY_REGISTERED"
                else:
                    res = service.process_face_sample(class_id, frame, main_face)
                    status = res.get("status", "UNKNOWN")
                    req_pose = res.get("req_pose")
                    det_pose = res.get("det_pose")

            if service.is_complete:
                service.save(class_id)
                status = "COMPLETE"

            pose_count = service.get_pose_count(req_pose) if req_pose else 0
            payload = {
                "status": status,
                "class_id": class_id,
                "det_pose": det_pose,
                "req_pose": req_pose,
                "db_id": db_id,
                "bbox": bbox,
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
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        return
