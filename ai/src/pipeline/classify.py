# ==============================================================================
#                           SECTION: PIPELINE MODULE
# ==============================================================================
"""
Pipeline module for chaining preprocessing models and the classifier.

This ensures a unified, streamlined process for embedding transformations
during validation and registration.
"""

from typing import Dict, List, Tuple, Optional
import numpy as np

from classify.preprocessing import PCAProcessor, ScalerProcessor
from classify.cosine_classifier import CosineClassifier, UNKNOWN
from utils.pose_utils import POSES


class ClassificationPipeline:
    """
    Orchestrates the sequence of dimensionality reduction (PCA), 
    normalization (Scaler), and classification logic.
    """
    
    def __init__(
        self,
        pca: PCAProcessor,
        scaler: ScalerProcessor,
        classifier: CosineClassifier
    ):
        """
        Initialize the classification pipeline.
        
        Args:
            pca: The trained PCAProcessor
            scaler: The trained ScalerProcessor
            classifier: The running CosineClassifier
        """
        self.pca = pca
        self.scaler = scaler
        self.classifier = classifier
        
    def transform(self, embeddings: np.ndarray) -> np.ndarray:
        """
        Transforms raw 512D embeddings into processed format using PCA and Scaler.
        
        Args:
            embeddings: Numpy array of shape (N, 512) or (512,)
            
        Returns:
            Processed embeddings for the classifier
        """
        # Ensure 2D array for preprocessing
        is_1d = embeddings.ndim == 1
        if is_1d:
            embeddings = embeddings.reshape(1, -1)
            
        processed = self.pca.transform(embeddings)

        # Disable scaling.
        # processed = self.scaler.transform(processed)
        
        if is_1d:
            return processed.flatten()
        return processed
        
    def predict_with_score(self, raw_embedding: np.ndarray) -> Tuple[Optional[str], float]:
        """
        Predicts the class ID and cosine distance score directly from a raw embedding.
        
        Args:
            raw_embedding: Raw 512D Numpy array from InsightFace
            
        Returns:
            Tuple of containing the (class_id, score)
        """
        processed_emb = self.transform(raw_embedding)

        return self.classifier.predict_with_score(processed_emb)

    def predict_use_pose(self, raw_embedding: np.ndarray, pose_name: str) -> str:
        """Predict class from a pose-specific collection."""
        processed_emb = self.transform(raw_embedding)
        collection = self._pose_collection(pose_name)
        return self.classifier.predict_from_collection(collection, processed_emb)

    def predict_use_pose_with_score(
        self, raw_embedding: np.ndarray, pose_name: str
    ) -> Tuple[Optional[str], float]:
        """Predict class with score from a pose-specific collection."""
        processed_emb = self.transform(raw_embedding)
        collection = self._pose_collection(pose_name)
        return self.classifier.predict_with_score_from_collection(collection, processed_emb)

    def fit(self, class_id: str, raw_embeddings: List[np.ndarray]) -> None:
        """
        Transforms raw feature embeddings and saves them as a new class in the DB.
        
        Args:
            class_id: The label for the entity being inserted
            raw_embeddings: A list of Numpy Arrays (from recog.face_recognition)
        """

        if not raw_embeddings:
            return
            
        emb_array = np.array(raw_embeddings)
        processed_embs = self.transform(emb_array)
        
        # Classifier.fit will handle adding these to the Milvus DB
        self.classifier.fit(class_id, processed_embs)

    def fit_with_pose(self, class_id: str, raw_embeddings: List[np.ndarray], pose_name: str) -> None:
        """Fit embeddings into a pose-specific collection."""
        if not raw_embeddings:
            return

        emb_array = np.array(raw_embeddings)
        processed_embs = self.transform(emb_array)
        collection = self._pose_collection(pose_name)
        self.classifier.fit_with_collection(collection, class_id, processed_embs)

    def _pose_collection(self, pose_name: str) -> str:
        pose_map = self._pose_collections()
        if pose_name not in pose_map:
            raise ValueError(f"Pose '{pose_name}' is not supported for pose collections.")
        return pose_map[pose_name]

    def _pose_collections(self) -> Dict[str, str]:
        return {
            pose: f"cosine_face_embeddings_pose_{pose.replace(' ', '_').lower()}"
            for pose in POSES
        }
