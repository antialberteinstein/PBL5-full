# ==============================================================================
#                           SECTION: COSINE CLASSIFIER MODULE
# ==============================================================================
"""
Cosine Classifier Implementation using vector database.

Uses Milvus Lite natively for ultra-fast vectorized cosine similarity search.
"""

import os
import logging
import numpy as np
from typing import Optional, Tuple
from pymilvus import MilvusClient, DataType


# ==============================================================================
#                           SECTION: CONFIGURATION
# ==============================================================================
# Global default configurations for cosine classifier have been moved into 
# the CosineClassifier class constructor.


# ==============================================================================
#                           SECTION: MATCHER CLASS
# ==============================================================================

UNKNOWN = "UNKNOWN"

class CosineClassifier:
    """
    Cosine similarity-based classifier using Milvus Lite vector database natively.
    """
    
    def __init__(
        self,
        verification_threshold: float = 0.51,
        collection_name: str = "cosine_face_embeddings",
        database_path: str = "database/milvus.db",
        metric_type: str = "IP",
        index_type: str = "FLAT",
    ):
        """Initialize classifier and database client."""
        self.verification_threshold = verification_threshold
        self.collection_name = collection_name
        self.database_path = database_path
        self.metric_type = metric_type
        self.index_type = index_type
        
        # Ensure database directory exists
        db_dir = os.path.dirname(self.database_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
        self.client = MilvusClient(self.database_path)
        
        logging.info(f"CosineClassifier initialized with database at {self.database_path}")
        
    def _resolve_collection(self, collection_name: Optional[str]) -> str:
        return collection_name or self.collection_name

    def _create_collection_if_not_exists(self, dim: int, collection_name: Optional[str] = None) -> None:
        """Create the collection with schema if it doesn't exist."""
        resolved_name = self._resolve_collection(collection_name)
        if self.client.has_collection(resolved_name):
            return
            
        # Create schema
        schema = self.client.create_schema(
            auto_id=True,
            enable_dynamic_field=False,
        )
        
        # Add fields
        schema.add_field(field_name="id", datatype=DataType.INT64, is_primary=True)
        schema.add_field(field_name="class_id", datatype=DataType.VARCHAR, max_length=256)
        schema.add_field(
            field_name="embedding",
            datatype=DataType.FLOAT_VECTOR,
            dim=dim
        )
        
        # Create index params
        index_params = self.client.prepare_index_params()
        index_params.add_index(
            field_name="embedding",
            index_type=self.index_type,
            metric_type=self.metric_type,
        )
        
        # Create collection
        self.client.create_collection(
            collection_name=resolved_name,
            schema=schema,
            index_params=index_params,
        )
        
        logging.info(f"Created collection '{resolved_name}' with dimension {dim}")

    def fit_with_collection(self, collection_name: str, class_id: str, embeddings: np.ndarray) -> None:
        """Fit classifier with embeddings into a specific collection."""
        if len(embeddings) == 0:
            return
        
        dim = embeddings.shape[1] if len(embeddings.shape) > 1 else len(embeddings)
        self._create_collection_if_not_exists(dim, collection_name)
        
        data = []
        for embedding in embeddings:
            normalized_emb = embedding / np.linalg.norm(embedding)
            data.append({
                "class_id": class_id,
                "embedding": normalized_emb.tolist(),
            })
        
        self.client.insert(
            collection_name=collection_name,
            data=data,
        )
        
        logging.info(
            f"Fitted class '{class_id}' with {len(embeddings)} new embeddings into '{collection_name}'"
        )

    def fit(self, class_id: str, embeddings: np.ndarray) -> None:
        """
        Fit classifier with new embeddings for a class.
        Inserts directly into Milvus without duplicate-checking logic for performance.
        
        Args:
            class_id: Class identifier
            embeddings: Embeddings array (N x D)
        """
        self.fit_with_collection(self.collection_name, class_id, embeddings)
    
    def predict(self, embedding: np.ndarray) -> str:
        """
        Predict class for an embedding using Milvus's native IP distance.
        
        Wrapper around predict_with_score() that returns only the label.
        
        Args:
            embedding: Query embedding (D,)
            
        Returns:
            Predicted class label (str), or UNKNOWN if no match
        """
        class_id, _ = self.predict_with_score(embedding)
        return class_id if class_id is not None else UNKNOWN

    def predict_from_collection(self, collection_name: str, embedding: np.ndarray) -> str:
        """Predict class for an embedding using a specific collection."""
        class_id, _ = self.predict_with_score_from_collection(collection_name, embedding)
        return class_id if class_id is not None else UNKNOWN
    
    def predict_with_score(self, embedding: np.ndarray) -> Tuple[Optional[str], Optional[float]]:
        """
        Predict class with similarity score using vector search natively.
        
        Args:
            embedding: Query embedding (D,)
            
        Returns:
            Tuple of (class_id, similarity_score) or (None, None) if no match
        """
        return self.predict_with_score_from_collection(self.collection_name, embedding)

    def predict_with_score_from_collection(
        self, collection_name: str, embedding: np.ndarray
    ) -> Tuple[Optional[str], Optional[float]]:
        """Predict class with similarity score from a specific collection."""
        if not self.client.has_collection(collection_name):
            return None, None
            
        normalized_emb = embedding / np.linalg.norm(embedding)
        
        try:
            results = self.client.search(
                collection_name=collection_name,
                data=[normalized_emb.tolist()],
                limit=1,
                output_fields=["class_id"],
            )
        except Exception as e:
            logging.error(f"Search failed: {e}")
            return None, None
            
        if not results or len(results[0]) == 0:
            return None, None
            
        hit = results[0][0]
        best_class = hit["entity"]["class_id"]
        best_similarity = hit["distance"]
        
        if best_similarity < self.verification_threshold:
            return None, best_similarity
        
        return best_class, best_similarity
        
    def get_vectors_by_id(self, class_id: str, collection_name: Optional[str] = None) -> np.ndarray:
        """
        Retrieve all vectors for a given class ID.
        
        Args:
            class_id: Class identifier
            
        Returns:
            Array of vectors (N x D), or empty array if no vectors found
        """
        resolved_name = self._resolve_collection(collection_name)
        if not self.client.has_collection(resolved_name):
            return np.array([])
            
        try:
            results = self.client.query(
                collection_name=resolved_name,
                filter=f'class_id == "{class_id}"',
                output_fields=["embedding"],
            )
        except Exception as e:
            logging.error(f"Failed to query vectors: {e}")
            return np.array([])
            
        if not results:
            return np.array([])
            
        vectors = [res["embedding"] for res in results]
        return np.array(vectors)
    
    def refresh(self) -> None:
        """Reload database limits from disk if needed."""
        # For MilvusLite, connections handle concurrency implicitly. No-op refresh.
        logging.info("Classifier refreshed (no-op)")
