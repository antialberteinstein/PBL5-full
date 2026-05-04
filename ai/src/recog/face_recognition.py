# ==============================================================================
#                           SECTION: FACE RECOGNITION
# ==============================================================================
"""
Face recognition implementation using InsightFace.

Provides face detection and embedding extraction using the
InsightFace library with a selectable model source.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

import logging
import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis
import insightface.utils.storage as storage

from config.recog_config import MODEL_NAME, CUSTOM_MODEL_URL


# ==============================================================================
#                           SECTION: DATA CLASSES
# ==============================================================================

@dataclass
class FaceDetection:
    """
    Represents a detected face in an image.
    
    Attributes:
        bbox: Bounding box coordinates [x1, y1, x2, y2]
        embedding: Face embedding vector
        confidence: Detection confidence score (0-1)
    """
    bbox: np.ndarray
    embedding: np.ndarray
    confidence: float
    landmarks: Optional[np.ndarray] = None
    pose: Optional[np.ndarray] = None


# ==============================================================================
#                           SECTION: ABSTRACT INTERFACE
# ==============================================================================

class FaceRecognizer(ABC):
    """
    Abstract interface for face recognition systems.
    
    This class defines the contract that all face recognition implementations
    must follow. It enables easy swapping between different face recognition
    models without changing the rest of the codebase.
    """
    
    @abstractmethod
    def detect(
        self,
        frame: np.ndarray,
    ) -> List[FaceDetection]:
        """
        Detect faces in an image frame.
        
        Args:
            frame: Input image as numpy array (BGR format from OpenCV)
            
        Returns:
            List of detected faces with bounding boxes and embeddings
        """
        pass
    
    @abstractmethod
    def extract_embedding(
        self,
        frame: np.ndarray,
        bbox: Optional[np.ndarray] = None,
    ) -> Optional[np.ndarray]:
        """
        Extract face embedding from a frame.
        
        Args:
            frame: Input image as numpy array (BGR format from OpenCV)
            bbox: Optional bounding box to extract from. If None, detects face first.
            
        Returns:
            Face embedding vector, or None if no face detected
        """
        pass
    
    @abstractmethod
    def prepare(self) -> None:
        """
        Initialize the face recognition model.
        
        This method should load models, allocate resources, and perform
        any necessary setup before the recognizer can be used.
        """
        pass


# ==============================================================================
#                           SECTION: IMPLEMENTATION
# ==============================================================================

class InsightFaceDetector(FaceRecognizer):
    """
    InsightFace-based face recognition implementation.

    InsightFace-based face recognition implementation.
    Automatically downloads and loads the model from a custom GitHub Release URL.
    """
    
    def __init__(
        self,
        device: str = "cpu",
        det_threshold: float = 0.5,
        det_size: tuple = (640, 640),
        allowed_modules: Optional[List[str]] = None,
        model_dir: Optional[str] = None,
    ):
        """Initialize InsightFace detector."""
        self.device = device
        self.det_threshold = det_threshold
        self.det_size = det_size
        self.allowed_modules = allowed_modules

        ### Resolve model source
        self._model_name = MODEL_NAME
        logging.info(f"[InsightFace] Model: {self._model_name} (Source: {CUSTOM_MODEL_URL})")
        
        self.app: Optional[FaceAnalysis] = None
        self._is_prepared = False
    
    def prepare(self) -> None:
        """
        Loads the model and prepares it for inference.
        """
        if self._is_prepared:
            return
        
        # 1. Override BASE_REPO_URL to point to Custom GitHub Release
        storage.BASE_REPO_URL = CUSTOM_MODEL_URL

        # 2. Build FaceAnalysis kwargs
        kwargs = {"name": self._model_name}
        if self.allowed_modules:
            kwargs["allowed_modules"] = self.allowed_modules

        # 3. Initialize FaceAnalysis
        try:
            self.app = FaceAnalysis(**kwargs)
        except TypeError:
            kwargs.pop("allowed_modules", None)
            self.app = FaceAnalysis(**kwargs)
        
        # 4. Prepare the app
        ctx_id = -1 if self.device == "cpu" else 0
        self.app.prepare(ctx_id=ctx_id, det_size=self.det_size)
        
        self._is_prepared = True
    
    def detect(
        self,
        frame: np.ndarray,
    ) -> List[FaceDetection]:
        """
        Detect faces in an image frame using InsightFace.
        
        Args:
            frame: Input image as numpy array (BGR format from OpenCV)
            
        Returns:
            List of detected faces with bounding boxes and embeddings
            
        Raises:
            RuntimeError: If detector is not prepared
        """
        if not self._is_prepared or self.app is None:
            raise RuntimeError(
                "InsightFace detector not prepared. Call prepare() first."
            )
        
        ### 1. Run face detection
        faces = self.app.get(frame)
        
        ### 2. Convert to FaceDetection objects
        detections = []
        for face in faces:
            score = float(face.det_score)
            
            # Dynamic threshold: profile faces score lower than frontal
            threshold = self.det_threshold
            if hasattr(face, 'pose') and face.pose is not None:
                pitch, yaw, roll = face.pose
                if abs(pitch) > 15 or abs(yaw) > 20:
                    threshold = max(0.50, self.det_threshold - 0.20)
            
            if score < threshold:
                logging.warning(
                    f"Ignored face: score {score:.2f} < {threshold:.2f} "
                    f"(base: {self.det_threshold:.2f})"
                )
                continue
                
            detection = FaceDetection(
                bbox=face.bbox.astype(int),
                embedding=face.embedding,
                confidence=score,
                landmarks=(
                    face.landmark_2d_106.astype(int)
                    if hasattr(face, 'landmark_2d_106') and face.landmark_2d_106 is not None
                    else None
                ),
                pose=face.pose if hasattr(face, 'pose') else None,
            )
            detections.append(detection)
        
        return detections
    
    def extract_embedding(
        self,
        frame: np.ndarray,
        bbox: Optional[np.ndarray] = None,
    ) -> Optional[np.ndarray]:
        """
        Extract face embedding from a frame.
        
        Args:
            frame: Input image as numpy array (BGR format from OpenCV)
            bbox: Optional bounding box. If None, detects face first.
            
        Returns:
            Face embedding vector, or None if no face detected
            
        Raises:
            RuntimeError: If detector is not prepared
        """
        if not self._is_prepared or self.app is None:
            raise RuntimeError(
                "InsightFace detector not prepared. Call prepare() first."
            )
        
        detections = self.detect(frame)
        if not detections:
            return None
        return detections[0].embedding
