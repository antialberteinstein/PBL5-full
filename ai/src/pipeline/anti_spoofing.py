"""Anti-spoofing pipeline implementation."""

from typing import List, Optional
import numpy as np
from dataclasses import dataclass
from anti_spoofing.as_detector import AntiSpoofingDetector

@dataclass
class AntiSpoofingResult:
    """Result of anti-spoofing check for a single face."""
    is_real: bool
    score: float
    bbox: Optional[dict] = None

class AntiSpoofingPipeline:
    """
    High-level pipeline for anti-spoofing detection.
    """
    
    def __init__(self, detector: Optional[AntiSpoofingDetector] = None):
        """
        Initialize the anti-spoofing pipeline.
        
        Args:
            detector: An instance of AntiSpoofingDetector. If None, a new one is created.
        """
        self.detector = detector or AntiSpoofingDetector()

    def process_frame(self, frame: np.ndarray) -> List[AntiSpoofingResult]:
        """
        Processes a frame and returns liveness results for all detected faces.
        
        Args:
            frame: Input image (BGR)
            
        Returns:
            List of AntiSpoofingResult objects.
        """
        raw_results = self.detector.analyze(frame)
        
        pipeline_results = []
        for res in raw_results:
            is_real = res.get("is_real", False)
            score = res.get("antispoof_score", 0.0)
            bbox = res.get("facial_area")
            
            pipeline_results.append(AntiSpoofingResult(
                is_real=is_real,
                score=score,
                bbox=bbox
            ))
            
        return pipeline_results
