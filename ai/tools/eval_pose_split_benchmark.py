"""Evaluate pose detection on pose-split-benchmark dataset."""

from __future__ import annotations

import os
import sys
import tempfile
from collections import Counter
from pathlib import Path
from time import perf_counter
from typing import Iterable, List, Tuple

import cv2
import numpy as np


current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.abspath(os.path.join(current_dir, "..", "src"))
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from classify.cosine_classifier import CosineClassifier
from classify.preprocessing import PCAProcessor, ScalerProcessor
from pipeline.classify import ClassificationPipeline
from recog.face_recognition import InsightFaceDetector
from utils.pose_utils import POSES, get_pose_name


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}
DATASET_ROOT = "dataset/pose-split-benchmark"
SKIP_MASKED = False

LAB_NAME = "Pose Split Benchmark - Pose Detection"
LAB_FILE_NAME = "pose_split_benchmark_pose_detection"
DB_NAME = "pose_benchmark.db"
COLLECTION_NAME = "pose_benchmark"
SINGLE_LABEL = "pose_benchmark"


def iter_images(root: Path) -> Iterable[Path]:
    for img_path in sorted(root.iterdir()):
        if img_path.suffix.lower() in IMAGE_EXTS and img_path.is_file():
            if SKIP_MASKED and "_masked" in img_path.stem:
                continue
            yield img_path


def extract_embeddings(paths: List[Path]) -> Tuple[List[np.ndarray], Counter, List[float], int, int]:
    print("Preparing recognizer...", flush=True)
    recognizer = InsightFaceDetector()
    recognizer.prepare()
    print("Recognizer ready. Detecting poses...", flush=True)

    embeddings: List[np.ndarray] = []
    pose_counts: Counter = Counter()
    latencies_ms: List[float] = []
    skipped = 0
    no_face = 0

    total = len(paths)
    for idx, img_path in enumerate(paths, start=1):
        img = cv2.imread(str(img_path))
        if img is None:
            skipped += 1
            continue

        print(f"{idx}/{total} Processing: {img_path}", flush=True)

        start = perf_counter()
        detections = recognizer.detect(img)
        end = perf_counter()

        if not detections:
            no_face += 1
            continue

        best = max(detections, key=lambda face: face.confidence)
        predicted = get_pose_name(best.pose)
        embeddings.append(best.embedding)
        pose_counts[predicted] += 1
        latencies_ms.append((end - start) * 1000.0)

    return embeddings, pose_counts, latencies_ms, skipped, no_face


def main() -> None:
    root = Path(DATASET_ROOT)
    if not root.exists():
        raise SystemExit(f"Dataset not found: {root}")

    print(f"Dataset: {root}", flush=True)
    paths = list(iter_images(root))
    if not paths:
        raise SystemExit("No images found in dataset.")

    embeddings, pose_counts, recog_lat_ms, skipped, no_face = extract_embeddings(paths)
    total = len(embeddings)
    if total == 0:
        raise SystemExit("No faces detected for evaluation.")

    pca = PCAProcessor()
    scaler = ScalerProcessor()
    print("Loading PCA/Scaler...", flush=True)
    if not pca.load():
        raise SystemExit("PCA model not found. Train or place models/pca_model.joblib.")
    if not scaler.load():
        raise SystemExit("Scaler model not found. Train or place models/scaler_model.joblib.")
    print("PCA/Scaler loaded.", flush=True)

    classify_lat_ms: List[float] = []
    total_lat_ms: List[float] = []
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = str(Path(tmpdir) / DB_NAME)
        classifier = CosineClassifier(database_path=db_path, collection_name=COLLECTION_NAME)
        pipeline = ClassificationPipeline(pca, scaler, classifier)
        pipeline.fit(SINGLE_LABEL, embeddings)

        for emb, recog_ms in zip(embeddings, recog_lat_ms):
            start = perf_counter()
            pipeline.predict_with_score(emb)
            end = perf_counter()
            cls_ms = (end - start) * 1000.0
            classify_lat_ms.append(cls_ms)
            total_lat_ms.append(recog_ms + cls_ms)

    print("\nSummary:")
    print(f"Total evaluated: {total}")
    if recog_lat_ms:
        print(
            f"Recog latency (ms): mean={np.mean(recog_lat_ms):.2f}, p50={np.median(recog_lat_ms):.2f}"
        )
    if classify_lat_ms:
        print(
            f"Classify latency (ms): mean={np.mean(classify_lat_ms):.2f}, p50={np.median(classify_lat_ms):.2f}"
        )
    if total_lat_ms:
        print(
            f"Total latency (ms): mean={np.mean(total_lat_ms):.2f}, p50={np.median(total_lat_ms):.2f}"
        )
    print(f"Skipped (read error): {skipped}")
    print(f"No face detected: {no_face}")

    results_dir = Path("results")
    results_dir.mkdir(exist_ok=True)
    results_file = results_dir / f"{LAB_FILE_NAME}.txt"
    with results_file.open("w") as f:
        f.write(f"Lab Name: {LAB_NAME}\n")
        f.write(f"Dataset: {DATASET_ROOT}\n")
        f.write(f"Total evaluated: {total}\n")
        if recog_lat_ms:
            f.write(
                f"Recog latency (ms): mean={np.mean(recog_lat_ms):.2f}, p50={np.median(recog_lat_ms):.2f}\n"
            )
        if classify_lat_ms:
            f.write(
                f"Classify latency (ms): mean={np.mean(classify_lat_ms):.2f}, p50={np.median(classify_lat_ms):.2f}\n"
            )
        if total_lat_ms:
            f.write(
                f"Total latency (ms): mean={np.mean(total_lat_ms):.2f}, p50={np.median(total_lat_ms):.2f}\n"
            )
        f.write(f"Skipped (read error): {skipped}\n")
        f.write(f"No face detected: {no_face}\n")
        f.write("\nPose distribution:\n")
        for pose in POSES:
            count = pose_counts.get(pose, 0)
            f.write(f"- {pose}: {count}\n")


if __name__ == "__main__":
    main()
