"""
Functional test script for the Anti-Spoofing Pipeline.
Opens a camera feed and runs the DeepFace-based anti-spoofing check,
displaying liveness status and confidence on the screen.
"""

import os
import sys
import logging
import cv2
import numpy as np

# Add src to path to allow imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from pipeline.anti_spoofing import AntiSpoofingPipeline
from camera.opencv_client import OpenCVCamera
import ui.colors as colors

# ==============================================================================
#                           SECTION: CONFIGURATION
# ==============================================================================
WINDOW_NAME = "Anti-Spoofing Test"
COLOR_REAL = colors.GREEN
COLOR_SPOOF = colors.RED
COLOR_TEXT = colors.CYAN

# ==============================================================================
#                                   SECTION: MAIN
# ==============================================================================

def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )
    
    logging.info("Initializing Anti-Spoofing Pipeline...")
    # Initialize the pipeline (will use 'insightface' as default backend)
    pipeline = AntiSpoofingPipeline()
    logging.info("Pipeline initialized.")
    
    logging.info("Starting camera...")
    camera = OpenCVCamera()
    
    logging.info("Press 'q' to quit.")
    
    try:
        while True:
            frame = camera.capture_frame()
            if frame is None:
                logging.error("Failed to read frame from camera.")
                continue
                
            display_frame = frame.copy()
            
            # Process frame through anti-spoofing pipeline
            results = pipeline.process_frame(frame)
            
            for res in results:
                # DeepFace returns bbox as a dict with keys: x, y, w, h
                bbox = res.bbox
                if bbox:
                    x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']
                    
                    # Determine color and label based on liveness
                    color = COLOR_REAL if res.is_real else COLOR_SPOOF
                    label = "REAL" if res.is_real else "SPOOF"
                    
                    # Draw bounding box
                    cv2.rectangle(display_frame, (x, y), (x + w, y + h), color, 2)
                    
                    # Draw text label and score
                    text = f"{label}: {res.score:.2f}"
                    cv2.putText(
                        display_frame, 
                        text, 
                        (x, y - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.7, 
                        color, 
                        2
                    )
            
            cv2.imshow(WINDOW_NAME, display_frame)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    except KeyboardInterrupt:
        logging.info("Interrupted by user.")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
    finally:
        camera.release()
        cv2.destroyAllWindows()
        logging.info("Resources released.")

if __name__ == "__main__":
    main()
