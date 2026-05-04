"""Module for anti-spoofing detection using DeepFace."""

from typing import List, Dict, Any, Optional
import numpy as np
from deepface import DeepFace
import logging

class AntiSpoofingDetector:
    """
    Detector for face liveness/anti-spoofing using DeepFace.
    """
    
    def __init__(self, detector_backend: str = 'retinaface'):
        """
        Initialize the anti-spoofing detector.
        
        Args:
            detector_backend: The backend to use for face detection within DeepFace.
                             Options: 'opencv', 'retinaface', 'mtcnn', 'ssd', 'dlib', 'mediapipe', 'yolov8', 'centerface', 'insightface'.
        """
        self.detector_backend = detector_backend
        logging.info(f"Initialized AntiSpoofingDetector with backend: {detector_backend}")

    def analyze(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Analyze a frame for spoofing attacks.
        
        Args:
            frame: Input image (BGR)
            
        Returns:
            List of results for each detected face. Each result contains 'is_real' and 'antispoof_score'.
        """
        try:
            # DeepFace.extract_faces returns a list of dictionaries
            # Each dictionary has "face", "facial_area", "confidence", "is_real", "antispoof_score"
            results = DeepFace.extract_faces(
                img_path=frame,
                detector_backend=self.detector_backend,
                anti_spoofing=True,
                enforce_detection=False
            )
            return results
        except Exception as e:
            logging.error(f"Error during anti-spoofing analysis: {e}")
            return []
