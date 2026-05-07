# ==============================================================================
#                           SECTION: VERIFICATION SERVICE
# ==============================================================================
"""
Business logic for face verification with anti-spoofing integration.
"""

from typing import List, Dict, Any, Optional, Sequence
import numpy as np
from utils.bbox_utils import calculate_iou, deepface_to_standard_bbox

class VerificationService:
    """Service for verifying faces against registered embeddings and checking liveness."""
    
    def __init__(
        self,
        recog_pipeline: Any,
        classify_pipeline: Any,
        anti_spoofing_pipeline: Optional[Any] = None,
    ):
        """
        Initialize verification service.
        
        Args:
            recog_pipeline: Pipeline for face detection and embedding extraction.
            classify_pipeline: Pipeline for face classification.
            anti_spoofing_pipeline: Optional pipeline for liveness detection.
        """
        self.recog_pipeline = recog_pipeline
        self.classify_pipeline = classify_pipeline
        self.anti_spoofing_pipeline = anti_spoofing_pipeline
    
    def verify(
        self,
        frame: np.ndarray,
        allowed_student_ids: Optional[Sequence[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Verify faces in a frame and check for spoofing attacks.
        
        Returns:
            List of dicts containing bbox, student_id, score, is_known, and liveness info.
        """
        # 1. Primary face recognition
        faces = self.recog_pipeline.process_frame(frame)
        
        # 2. Optional Anti-spoofing
        antispoof_results = []
        if self.anti_spoofing_pipeline:
            antispoof_results = self.anti_spoofing_pipeline.process_frame(frame)
        
        results = []
        for face in faces:
            # Classification
            student_id, score = self.classify_pipeline.predict_with_score(
                face.embedding,
                allowed_student_ids=allowed_student_ids,
            )
            is_known = student_id is not None and "UNKNOWN" not in str(student_id)
            
            # Match with anti-spoofing results using IoU
            is_real = True  # Default to True if no anti-spoofing or no match
            antispoof_score = 1.0
            
            best_iou = 0
            for as_res in antispoof_results:
                if as_res.bbox:
                    as_bbox = deepface_to_standard_bbox(as_res.bbox)
                    iou = calculate_iou(face.bbox, as_bbox)
                    if iou > best_iou:
                        best_iou = iou
                        if iou > 0.3: # Lower threshold
                            is_real = as_res.is_real
                            antispoof_score = as_res.score
            
            if self.anti_spoofing_pipeline and best_iou < 0.3:
                import logging
                logging.warning(f"Anti-spoofing match failed for a face (best IoU: {best_iou:.2f})")
                # Optional: Decide whether to default to True or False
                # For now, keep True but log the failure
            
            results.append({
                "bbox": face.bbox,
                "student_id": student_id,
                "score": score,
                "is_known": is_known,
                "is_real": is_real,
                "antispoof_score": antispoof_score,
            })
            
        return results
