"""Test anti-spoofing pipeline using OpenCV camera."""

from __future__ import annotations

import os
import sys
import threading
import time
import cv2

current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.abspath(os.path.join(current_dir, "..", "src"))
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from pipeline.anti_spoofing import AntiSpoofingPipeline
from pipeline.recog import RecognitionPipeline
from recog.face_recognition import InsightFaceDetector


def main() -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Failed to open camera")

    anti_pipeline = AntiSpoofingPipeline()
    recognizer = InsightFaceDetector()
    recognizer.prepare()
    recog_pipeline = RecognitionPipeline(recognizer)
    window_name = "Anti-Spoofing Test"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    stop_event = threading.Event()
    latest_frame = None
    latest_result = None
    latest_bbox = None
    data_lock = threading.Lock()

    def _worker() -> None:
        nonlocal latest_frame, latest_result, latest_bbox
        while not stop_event.is_set():
            with data_lock:
                frame_copy = None if latest_frame is None else latest_frame.copy()

            if frame_copy is None:
                time.sleep(0.01)
                continue

            detections = recog_pipeline.recognizer.detect(frame_copy)
            main_face = None
            if detections:
                main_face = max(
                    detections,
                    key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
                )

            face_frame = frame_copy
            bbox = None
            if main_face is not None:
                x1, y1, x2, y2 = main_face.bbox.astype(int)
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(frame_copy.shape[1], x2)
                y2 = min(frame_copy.shape[0], y2)
                if x2 > x1 and y2 > y1:
                    face_frame = frame_copy[y1:y2, x1:x2]
                    bbox = (x1, y1, x2, y2)

            result = anti_pipeline.predict(face_frame)

            with data_lock:
                latest_result = result
                latest_bbox = bbox

            time.sleep(0.01)

    worker = threading.Thread(target=_worker, daemon=True)
    worker.start()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                cv2.waitKey(30)
                continue

            with data_lock:
                latest_frame = frame
                result = latest_result
                bbox = latest_bbox

            if bbox is not None:
                cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (255, 200, 0), 2)

            if result is not None:
                status = "SPOOF" if result.is_spoof else "LIVE"
                color = (0, 0, 255) if result.is_spoof else (0, 255, 0)
                text = f"{status} | score={result.score:.3f}"
            else:
                text = "WAITING | score=N/A"
                color = (255, 255, 255)

            cv2.putText(
                frame,
                text,
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                color,
                2,
            )

            cv2.imshow(window_name, frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:
                break
    finally:
        stop_event.set()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
