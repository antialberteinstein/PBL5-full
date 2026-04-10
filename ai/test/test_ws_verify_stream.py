"""WebSocket client to test /ws/verify_stream."""

from __future__ import annotations

import argparse
import asyncio
import json
import queue
import threading
import time
from typing import Optional

import cv2
import websockets


def _encode_jpeg(frame, quality: int) -> Optional[bytes]:
    ok, buf = cv2.imencode(
        ".jpg",
        frame,
        [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)],
    )
    if not ok:
        return None
    return buf.tobytes()


def _get_frame(cap: cv2.VideoCapture, image_path: Optional[str]) -> Optional[cv2.Mat]:
    if image_path:
        frame = cv2.imread(image_path)
    else:
        ret, frame = cap.read()
        if not ret:
            return None
    return frame


def _draw_faces(frame: cv2.Mat, faces: list) -> None:
    for face in faces:
        bbox = face.get("bbox")
        class_id = face.get("class_id")
        score = face.get("score")
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


def _render_preview(frame, status: str) -> Optional[cv2.Mat]:
    if frame is None:
        return None
    border_px = 24
    border_color = (255, 0, 255)
    canvas = cv2.copyMakeBorder(
        frame,
        border_px,
        border_px,
        border_px,
        border_px,
        cv2.BORDER_CONSTANT,
        value=border_color,
    )
    label = f"LOCAL VERIFY | {status}"
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


async def _ws_worker(
    url: str,
    jpeg_quality: int,
    frame_queue: queue.Queue,
    response_queue: queue.Queue,
    stop_event: threading.Event,
) -> None:
    while not stop_event.is_set():
        try:
            async with websockets.connect(url, max_size=10 * 1024 * 1024) as ws:
                while not stop_event.is_set():
                    try:
                        frame = frame_queue.get(timeout=0.05)
                    except queue.Empty:
                        await asyncio.sleep(0.01)
                        continue

                    jpg = _encode_jpeg(frame, jpeg_quality)
                    if jpg is None:
                        continue

                    await ws.send(jpg)
                    msg = await ws.recv()
                    payload = json.loads(msg)
                    response_queue.put(payload)
        except websockets.exceptions.ConnectionClosedError as exc:
            print(f"WebSocket closed unexpectedly: {exc}")
            await asyncio.sleep(0.5)


def _run_ws_thread(
    url: str,
    jpeg_quality: int,
    frame_queue: queue.Queue,
    response_queue: queue.Queue,
    stop_event: threading.Event,
) -> None:
    asyncio.run(_ws_worker(url, jpeg_quality, frame_queue, response_queue, stop_event))


async def run_client(
    base_url: str,
    image_path: Optional[str],
    fps: float,
    jpeg_quality: int,
) -> None:
    url = f"{base_url}/ws/verify_stream"
    interval = 1.0 / fps if fps > 0 else 0

    window_name = "Local Verify Stream"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    frame_queue: queue.Queue = queue.Queue(maxsize=2)
    response_queue: queue.Queue = queue.Queue(maxsize=20)
    stop_event = threading.Event()

    cap = None
    if not image_path:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            raise RuntimeError("Failed to open camera")

    ws_thread = threading.Thread(
        target=_run_ws_thread,
        args=(url, jpeg_quality, frame_queue, response_queue, stop_event),
        daemon=True,
    )
    ws_thread.start()

    last_payload = {"status": "OK", "faces": []}

    try:
        while not stop_event.is_set():
            frame = _get_frame(cap, image_path)
            if frame is None:
                time.sleep(0.02)
                continue

            while True:
                try:
                    last_payload = response_queue.get_nowait()
                    print(json.dumps(last_payload, ensure_ascii=True))
                except queue.Empty:
                    break

            faces = last_payload.get("faces") or []
            _draw_faces(frame, faces)
            preview = _render_preview(frame, last_payload.get("status", ""))
            if preview is not None:
                cv2.imshow(window_name, preview)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q") or key == 27:
                    stop_event.set()
                    break

            if not frame_queue.full():
                frame_queue.put(frame)

            if interval:
                time.sleep(interval)
    finally:
        stop_event.set()
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()


def main() -> None:
    parser = argparse.ArgumentParser(description="Test verify_stream WebSocket")
    parser.add_argument("--base-url", default="ws://127.0.0.1:8000")
    parser.add_argument("--image", help="Path to image to send repeatedly")
    parser.add_argument("--fps", type=float, default=5.0)
    parser.add_argument("--jpeg-quality", type=int, default=85)
    args = parser.parse_args()

    asyncio.run(
        run_client(
            base_url=args.base_url,
            image_path=args.image,
            fps=args.fps,
            jpeg_quality=args.jpeg_quality,
        )
    )


if __name__ == "__main__":
    main()
