"""Simple evaluation for LFW using recog + classify pipeline."""

from __future__ import annotations

import os
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from time import perf_counter
from typing import Iterable, List, Tuple

import cv2
import numpy as np
from sklearn.model_selection import train_test_split


current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.abspath(os.path.join(current_dir, "..", "src"))
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from classify.cosine_classifier import CosineClassifier
from classify.preprocessing import PCAProcessor, ScalerProcessor
from pipeline.classify import ClassificationPipeline
from pipeline.recog import RecognitionPipeline
from recog.face_recognition import InsightFaceDetector


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}

DATASET_ROOT = "dataset/lfw_decrease"
MIN_PER_LABEL = 2
MAX_PER_LABEL = 0
TEST_SIZE = 0.2
RANDOM_STATE = 42
DB_NAME = "test.db"  # Temporary DB for evaluation (will be deleted after the evaluation com
COLLECTION_NAME = "without_scaler"

LAB_NAME = "Ver2: Test on LFW Dataset Pruned (with PCA + without Scaler) - CosineClassifier"  # For logging purposes (not used in code logic)
LAB_FILE_NAME = LAB_NAME.lower().replace(" ", "_")  # For saving results (e.g., results/test_on_lfw_dataset_pruned_with_pca_scaler_cosineclassifier.txt

def iter_images(root: Path) -> Iterable[Tuple[str, Path]]:
    for label_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for img_path in sorted(label_dir.iterdir()):
            if img_path.suffix.lower() in IMAGE_EXTS and img_path.is_file():
                yield label_dir.name, img_path


def load_dataset(root: Path, min_per_label: int, max_per_label: int) -> Tuple[List[str], List[Path]]:
    labels: List[str] = []
    paths: List[Path] = []

    label_to_paths: dict[str, List[Path]] = defaultdict(list)
    for label, img_path in iter_images(root):
        label_to_paths[label].append(img_path)

    for label, img_list in sorted(label_to_paths.items()):
        if len(img_list) < min_per_label:
            continue
        if max_per_label > 0:
            img_list = img_list[:max_per_label]
        for img_path in img_list:
            labels.append(label)
            paths.append(img_path)

    return labels, paths


def extract_embeddings(labels: List[str], paths: List[Path]) -> Tuple[np.ndarray, List[str], List[float], int]:
    print("Preparing recognizer...", flush=True)
    recognizer = InsightFaceDetector()
    print("Calling recognizer.prepare()...", flush=True)
    recognizer.prepare()
    print("recognizer.prepare() done.", flush=True)
    recog_pipeline = RecognitionPipeline(recognizer)
    print("Recognizer ready. Extracting embeddings...", flush=True)

    embeddings: List[np.ndarray] = []
    out_labels: List[str] = []
    latencies_ms: List[float] = []
    skipped = 0

    total = len(labels)
    for idx, (label, img_path) in enumerate(zip(labels, paths), start=1):
        img = cv2.imread(str(img_path))
        if img is None:
            skipped += 1
            continue

        print(f'{idx}/{total} Processing: {img_path} (label: {label})', flush=True)

        start = perf_counter()
        detections = recog_pipeline.recognizer.detect(img)
        end = perf_counter()

        if not detections:
            skipped += 1
            continue

        best = max(detections, key=lambda face: face.confidence)
        embeddings.append(best.embedding)
        out_labels.append(label)
        latencies_ms.append((end - start) * 1000.0)

        if idx % 500 == 0 or idx == total:
            print(f"Embedding progress: {idx}/{total}", flush=True)

    return np.array(embeddings), out_labels, latencies_ms, skipped


def main() -> None:
    root = Path(DATASET_ROOT)
    if not root.exists():
        raise SystemExit(f"Dataset not found: {root}")

    print(f"Dataset: {root}", flush=True)
    print("Loading dataset index...", flush=True)
    labels, paths = load_dataset(root, MIN_PER_LABEL, MAX_PER_LABEL)
    if not labels:
        raise SystemExit("No samples found after filtering by min-per-label.")

    print(f"Total samples after filter: {len(labels)}", flush=True)

    embeddings, labels, recog_lat_ms, skipped = extract_embeddings(labels, paths)
    if len(embeddings) == 0:
        raise SystemExit("No embeddings extracted (all images skipped).")

    print(f"Skipped (no face/read error): {skipped}", flush=True)
    print(
        f"Recognition latency (ms): mean={np.mean(recog_lat_ms):.2f}, p50={np.median(recog_lat_ms):.2f}",
        flush=True,
    )

    pca = PCAProcessor()
    scaler = ScalerProcessor()
    print("Loading PCA/Scaler...", flush=True)
    if not pca.load():
        raise SystemExit("PCA model not found. Train or place models/pca_model.joblib.")
    if not scaler.load():
        raise SystemExit("Scaler model not found. Train or place models/scaler_model.joblib.")
    print("PCA/Scaler loaded.", flush=True)

    X = embeddings
    y = np.array(labels)

    train_idx, test_idx = train_test_split(
        np.arange(len(y)),
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = str(Path(tmpdir) / DB_NAME)
        classifier = CosineClassifier(database_path=db_path, collection_name=COLLECTION_NAME)
        pipeline = ClassificationPipeline(pca, scaler, classifier)

        train_by_label: dict[str, List[np.ndarray]] = defaultdict(list)
        for idx in train_idx:
            train_by_label[y[idx]].append(X[idx])

        for label, emb_list in train_by_label.items():
            pipeline.fit(label, emb_list)

        print(f"Training labels: {len(train_by_label)}", flush=True)

        correct = 0
        total = 0
        classify_lat_ms: List[float] = []
        for idx in test_idx:
            start = perf_counter()
            pred, _ = pipeline.predict_with_score(X[idx])
            end = perf_counter()
            classify_lat_ms.append((end - start) * 1000.0)

            if pred == y[idx]:
                correct += 1
            total += 1

        acc = correct / total if total > 0 else 0.0

    print("\nSummary:")
    print(f"Accuracy: {acc:.4f}")
    print(f"Classification latency (ms): mean={np.mean(classify_lat_ms):.2f}, p50={np.median(classify_lat_ms):.2f}")

    # Create the results directory if it doesn't exist
    results_dir = Path("results")
    results_dir.mkdir(exist_ok=True)
    results_file = results_dir / f"{LAB_FILE_NAME}.txt"
    with results_file.open("w") as f:
        f.write(f"Lab Name: {LAB_NAME}\n")
        f.write(f"Dataset: {DATASET_ROOT}\n")
        f.write(f"Total samples after filter: {len(labels)}\n")
        f.write(f"Skipped (no face/read error): {skipped}\n")
        f.write(
            f"Recognition latency (ms): mean={np.mean(recog_lat_ms):.2f}, p50={np.median(recog_lat_ms):.2f}\n"
        )
        f.write(f"Training labels: {len(train_by_label)}\n")
        f.write(f"Accuracy: {acc:.4f}\n")
        f.write(
            f"Classification latency (ms): mean={np.mean(classify_lat_ms):.2f}, p50={np.median(classify_lat_ms):.2f}\n"
        )


if __name__ == "__main__":
    main()
