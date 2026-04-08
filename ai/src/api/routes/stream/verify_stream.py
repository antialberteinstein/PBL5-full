"""Streaming WebSocket endpoint for verification without UI."""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.bridges.service.service_bridge import get_verification_service
from api.routes.stream.common import decode_frame, serialize_face_result

router = APIRouter(tags=["streaming"])


@router.websocket("/ws/verify_stream")
async def verify_stream(websocket: WebSocket) -> None:
    await websocket.accept()

    service = get_verification_service()

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

            results = service.verify(frame)
            safe_results = [serialize_face_result(face) for face in results]
            payload = {
                "status": "OK",
                "faces": safe_results,
            }
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        return
