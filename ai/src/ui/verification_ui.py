# ==============================================================================
#                           SECTION: VERIFICATION UI
# ==============================================================================
"""
Real-time UI for face verification.
"""

import cv2
import logging
import sys
from typing import Any
from services.verification_service import VerificationService
import ui.colors as colors

class VerificationUI:
    """UI for real-time face verification."""
    
    def __init__(
        self,
        recog_pipeline,
        classify_pipeline,
        window_name: str = "Verification",
        color_success: tuple = colors.GREEN,
        color_failure: tuple = colors.RED,
        on_match=None,
        on_frame=None,
        emit_interval_sec: float = 2.0,
        stop_event=None,
    ):
        """
        Initialize Verification UI.
        """
        self.service = VerificationService(
            recog_pipeline=recog_pipeline,
            classify_pipeline=classify_pipeline
        )
        self.window_name = window_name
        self.color_success = color_success
        self.color_failure = color_failure
        self.on_match = on_match
        self.on_frame = on_frame
        self.emit_interval_sec = emit_interval_sec
        self.stop_event = stop_event
        self._last_emit = {}

    def run(self, camera: Any, show_ui: bool = True) -> None:
        import threading
        import time
        
        logging.info("Starting verification UI via Background Thread")
        
        self._stop_event = threading.Event()
        self._latest_frame = None
        self._latest_results = []
        self._results_lock = threading.Lock()
        
        def _pipeline_worker():
            while not self._stop_event.is_set():
                if self.stop_event is not None and self.stop_event.is_set():
                    self._stop_event.set()
                    break
                if self._latest_frame is not None:
                    frame_copy = self._latest_frame.copy()
                    try:
                        results = self.service.verify(frame_copy)
                        with self._results_lock:
                            self._latest_results = results
                    except Exception as e:
                        logging.error(f"Verification pipeline error: {e}")
                time.sleep(0.1)  # Rest interval to prevent lag

        worker = threading.Thread(target=_pipeline_worker, daemon=True)
        worker.start()
        
        while True:
            if self.stop_event is not None and self.stop_event.is_set():
                self._stop_event.set()
                break
            frame = camera.capture_frame()
            if frame is None:
                cv2.waitKey(100)
                continue
                
            # Update latest frame for background processing
            self._latest_frame = frame
            
            # Draw from cache
            with self._results_lock:
                results_copy = self._latest_results.copy()

            if self.on_frame is not None:
                try:
                    self.on_frame(frame, results_copy)
                except Exception as e:
                    logging.error("on_frame callback failed: %s", e)
                
            for res in results_copy:
                self._draw_result(frame, res)
                    
                if res["is_known"]:
                    camera.send_result(f"MATCH: {res['class_id']} ({res['score']:.2f})")
                    if self.on_match is not None:
                        class_id = res.get("class_id")
                        now = time.time()
                        last_emit = self._last_emit.get(class_id, 0.0)
                        if now - last_emit >= self.emit_interval_sec:
                            self._last_emit[class_id] = now
                            try:
                                self.on_match(class_id, res.get("score"))
                            except Exception as e:
                                logging.error("on_match callback failed: %s", e)
            
            if show_ui:
                cv2.imshow(self.window_name, frame)
                cv2.setWindowProperty(self.window_name, cv2.WND_PROP_TOPMOST, 1)

                key = cv2.waitKey(30) & 0xFF
                if key == ord("q") or key == 27:
                    self._stop_event.set()
                    break
            
        worker.join(timeout=1.0)
        if show_ui:
            cv2.destroyAllWindows()
            import sys
            if sys.platform == "darwin":
                # Extra wait for macOS OpenCV window cleanup
                for _ in range(30):
                    cv2.waitKey(1)

    def _draw_result(self, frame, res):
        box = res["bbox"].astype(int)
        color = self.color_success if res["is_known"] else self.color_failure
        
        # Draw BBox
        cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), color, 2)
        
        # Draw ID and Score
        score_val = res["score"]

        if score_val is None:
            score_str = "N/A"
        else:
            score_str = f"{score_val:.2f}" if score_val != float('inf') else "inf"
        text = f"{res['class_id']}: {score_str}" if res["is_known"] else f"UNKNOWN: {score_str}"
        cv2.putText(frame, text, (box[0], box[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        

