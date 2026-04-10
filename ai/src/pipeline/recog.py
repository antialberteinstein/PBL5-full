# ==============================================================================
#                           SECTION: RECOGNITION PIPELINE
# ==============================================================================
"""
Unified Recognition Pipeline.

Combines Face Detection (InsightFace) and Classification (PCA + Scaler + Cosine)
into a single, easy-to-use interface for all modules.
"""

from dataclasses import dataclass
from typing import List, Optional
import numpy as np

from recog.face_recognition import FaceRecognizer

@dataclass
class ProcessedFace:
    """Combines detection data with pose information."""
    bbox: np.ndarray
    embedding: np.ndarray
    confidence: float
    pose: Optional[np.ndarray]
    pose_name: Optional[str]
    landmarks: Optional[np.ndarray] = None

class RecognitionPipeline:
    """
    High-level orchestrator for the entire face recognition process.
    """
    
    def __init__(
        self,
        recognizer: FaceRecognizer,
        include_pose: bool = True,
        include_landmarks: bool = True,
    ):
        """
        Initialize the recognition pipeline.
        
        Args:
            recognizer: The detector/embedder (e.g., InsightFace)
        """
        self.recognizer = recognizer
        self.include_pose = include_pose
        self.include_landmarks = include_landmarks

    def process_frame(self, frame: np.ndarray) -> List[ProcessedFace]:
        """
        Processes a full frame: detects faces and extracts pose information.
        
        Args:
            frame: Input image (BGR)
            
        Returns:
            List of ProcessedFace objects
        """
        # 1. Detect faces
        detections = self.recognizer.detect(frame)
        
        # 2. Extract optional metadata for each face
        from utils.pose_utils import get_pose_name
        
        results = []
        for face in detections:
            pose_value = None
            pose_name = None
            if self.include_pose and getattr(face, "pose", None) is not None:
                pose_value = face.pose
                pose_name = get_pose_name(face.pose)

            landmarks = None
            if self.include_landmarks:
                landmarks = getattr(face, "landmarks", None)
            
            results.append(ProcessedFace(
                bbox=face.bbox,
                embedding=face.embedding,
                confidence=face.confidence,
                pose=pose_value,
                pose_name=pose_name,
                landmarks=landmarks,
            ))
            
        return results
