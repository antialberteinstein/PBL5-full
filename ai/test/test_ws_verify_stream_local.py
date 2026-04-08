"""WebSocket client to test /ws/verify_stream_local (local camera stream)."""

from __future__ import annotations

import argparse
import json
from typing import Any, Dict, List

import cv2
import numpy as np
import websockets
import asyncio


def _draw_faces(frame: np.ndarray, faces: List[Dict[str, Any]]) -> None:
    for face in faces:
        bbox = face.get("bbox")
        class_id = face.get("class_id")
        score = face.get("score")
        pose_name = face.get("pose_name")
        label_id = "UNKNOWN" if class_id is None else str(class_id)
        is_unknown = "UNKNOWN" in label_id
        if isinstance(bbox, list) and len(bbox) == 4:
            x1, y1, x2, y2 = [int(v) for v in bbox]
            box_color = (0, 0, 255) if is_unknown else (0, 255, 0)
            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
            label = f"{label_id} {score:.3f}" if score is not None else f"{label_id}"
            cv2.putText(
                frame,
                label,
                (x1, max(20, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                box_color,
                2,
            )
            if pose_name:
                cv2.putText(
                    frame,
                    str(pose_name),
                    (x1, y2 + 20),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                )


def _render_preview(frame: np.ndarray, status: str) -> np.ndarray:
    border_px = 24
    border_color = (255, 128, 0)
    canvas = cv2.copyMakeBorder(
        frame,
        border_px,
        border_px,
        border_px,
        border_px,
        cv2.BORDER_CONSTANT,
        value=border_color,
    )
    label = f"LOCAL VERIFY (REMOTE VIEW) | {status}"
    cv2.putText(
        canvas,
        label,
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (255, 255, 255),
        2,
    )
    return canvas


async def run_client(base_url: str) -> None:
    url = f"{base_url}/ws/verify_stream_local"
    window_name = "Local Verify Stream (Remote View)"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    async with websockets.connect(url, max_size=20 * 1024 * 1024) as ws:
        while True:
            meta_msg = await ws.recv()
            if isinstance(meta_msg, bytes):
                continue
            meta = json.loads(meta_msg)
            if meta.get("status") == "completed":
                break

            frame_msg = await ws.recv()
            if not isinstance(frame_msg, (bytes, bytearray)):
                continue

            frame_array = np.frombuffer(frame_msg, dtype=np.uint8)
            frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            faces = meta.get("faces") or []
            _draw_faces(frame, faces)
            preview = _render_preview(frame, meta.get("status", "OK"))
            cv2.imshow(window_name, preview)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:
                break

    cv2.destroyAllWindows()


def main() -> None:
    parser = argparse.ArgumentParser(description="Test verify_stream_local WebSocket")
    parser.add_argument("--base-url", default="ws://127.0.0.1:8000")
    args = parser.parse_args()

    asyncio.run(run_client(args.base_url))


if __name__ == "__main__":
    main()
