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
from typing import Tuple, Optional, Sequence
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
        verification_threshold: float = 0.40,
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
        
    def _create_collection_if_not_exists(self, dim: int) -> None:
        """Create the collection with schema if it doesn't exist."""
        if self.client.has_collection(self.collection_name):
            return
            
        # Create schema
        schema = self.client.create_schema(
            auto_id=True,
            enable_dynamic_field=False,
        )
        
        # Add fields
        schema.add_field(field_name="id", datatype=DataType.INT64, is_primary=True)
        schema.add_field(field_name="student_id", datatype=DataType.VARCHAR, max_length=256)
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
            collection_name=self.collection_name,
            schema=schema,
            index_params=index_params,
        )
        
        logging.info(f"Created collection '{self.collection_name}' with dimension {dim}")

    def fit(self, student_id: str, embeddings: np.ndarray) -> None:
        """
        Fit classifier with new embeddings for a class.
        Inserts directly into Milvus without duplicate-checking logic for performance.
        
        Args:
            student_id: Student identifier
            embeddings: Embeddings array (N x D)
        """
        if len(embeddings) == 0:
            return
            
        # Auto-detect dimension from inputs
        dim = embeddings.shape[1] if len(embeddings.shape) > 1 else len(embeddings)
        self._create_collection_if_not_exists(dim)
        
        # Prepare data for insertion
        data = []
        for embedding in embeddings:
            # Normalize embedding for cosine similarity using IP metric
            normalized_emb = embedding / np.linalg.norm(embedding)
            data.append({
                "student_id": student_id,
                "embedding": normalized_emb.tolist(),
            })
        
        # Insert data
        self.client.insert(
            collection_name=self.collection_name,
            data=data,
        )
        
        logging.info(f"Fitted student '{student_id}' with {len(embeddings)} new embeddings")
    
    def predict(self, embedding: np.ndarray, allowed_student_ids: Optional[Sequence[str]] = None) -> str:
        """
        Predict class for an embedding using Milvus's native IP distance.
        
        Wrapper around predict_with_score() that returns only the label.
        
        Args:
            embedding: Query embedding (D,)
            
        Returns:
            Predicted class label (str), or UNKNOWN if no match
        """
        student_id, _ = self.predict_with_score(embedding, allowed_student_ids=allowed_student_ids)
        return student_id if student_id is not None else UNKNOWN
    
    def _build_filter_expr(self, allowed_student_ids: Sequence[str]) -> str:
        safe_values = []
        for value in allowed_student_ids:
            if value is None:
                continue
            safe_values.append(str(value).replace("\"", "\\\""))
        if not safe_values:
            return ""
        quoted = ", ".join([f'"{val}"' for val in safe_values])
        return f"student_id in [{quoted}]"

    def predict_with_score(
        self,
        embedding: np.ndarray,
        allowed_student_ids: Optional[Sequence[str]] = None,
    ) -> Tuple[Optional[str], Optional[float]]:
        """
        Predict class with similarity score using vector search natively.
        
        Args:
            embedding: Query embedding (D,)
            
        Returns:
            Tuple of (student_id, similarity_score) or (None, None) if no match
        """
        # Quick check to avoid searching if db hasn't been initialized
        if not self.client.has_collection(self.collection_name):
            return None, None
            
        # Normalize query embedding identically to training ones
        normalized_emb = embedding / np.linalg.norm(embedding)
        
        try:
            # Native Milvus search returns the most similar vectors instantly!
            search_kwargs = {
                "collection_name": self.collection_name,
                "data": [normalized_emb.tolist()],
                "limit": 1,
                "output_fields": ["student_id"],
            }
            if allowed_student_ids is not None:
                filter_expr = self._build_filter_expr(allowed_student_ids)
                if not filter_expr:
                    return None, None
                search_kwargs["filter"] = filter_expr

            results = self.client.search(**search_kwargs)
        except Exception as e:
            logging.error(f"Search failed: {e}")
            return None, None
            
        # Empty collection or no hits thresholded
        if not results or len(results[0]) == 0:
            return None, None
            
        # hit definition
        hit = results[0][0]
        best_student = hit["entity"]["student_id"]
        best_similarity = hit["distance"]  # IP measurement acts precisely as Cosine similarity here!
        
        # Check threshold
        if best_similarity < self.verification_threshold:
            return None, best_similarity
        
        return best_student, best_similarity
        
    def delete_student(self, student_id: str) -> int:
        """
        Remove all embeddings for a student. Returns the number of deleted rows.
        Safe to call when the collection does not exist yet.
        """
        if not self.client.has_collection(self.collection_name):
            return 0
        safe_id = str(student_id).replace("\"", "\\\"")
        try:
            result = self.client.delete(
                collection_name=self.collection_name,
                filter=f'student_id == "{safe_id}"',
            )
        except Exception as e:
            logging.error(f"Failed to delete embeddings for '{student_id}': {e}")
            return 0
        deleted = 0
        if isinstance(result, dict):
            deleted = int(result.get("delete_count", 0) or 0)
        logging.info(f"Deleted {deleted} embeddings for '{student_id}'")
        return deleted

    def get_vectors_by_id(self, student_id: str) -> np.ndarray:
        """
        Retrieve all vectors for a given class ID.
        
        Args:
            student_id: Student identifier
            
        Returns:
            Array of vectors (N x D), or empty array if no vectors found
        """
        if not self.client.has_collection(self.collection_name):
            return np.array([])
            
        try:
            results = self.client.query(
                collection_name=self.collection_name,
                filter=f'student_id == "{student_id}"',
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
