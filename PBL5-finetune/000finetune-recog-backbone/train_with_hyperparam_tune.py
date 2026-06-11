"""
train_with_hyperparam_tune.py
─────────────────────────────
Hyperparameter tuning cho InsightFace LoRA fine-tuning dùng Optuna.

Các tham số được TUNE:
  - learning_rate       : log-uniform [5e-5, 5e-4]
  - weight_decay        : log-uniform [1e-4, 5e-2]
  - lora_r              : categorical [4, 8, 16, 32]
  - lora_dropout        : uniform     [0.0, 0.20]
  - head_warmup_epochs  : int         [1, 3]
  - margin_m2           : uniform     [0.20, 0.50]  (ArcFace m2)

Objective (maximize):
  score = 2 × acc(special_test) + 1 × acc(lfw_decrease)

Sau khi kết thúc:
  → best_config.yml  (cấu trúc giống train_config.yml, chứa best params)
"""

import gc
import os
import sys
import copy
import time
import yaml
import logging
import argparse
import tempfile
from pathlib import Path
from glob import glob

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import onnx
import optuna
from optuna.samplers import TPESampler
from peft import LoraConfig, get_peft_model
from sklearn.metrics.pairwise import cosine_similarity

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backbone.iresnet import iresnet50
from insightface_pipeline.losses import CombinedMarginLoss
from insightface_pipeline.partial_fc_mps import PartialFC_V2_MPS
from insightface_pipeline.utils.utils_logging import AverageMeter

# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

optuna.logging.set_verbosity(optuna.logging.WARNING)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def load_yaml(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# ──────────────────────────────────────────────────────────────
# Evaluation  (cosine-similarity nearest-neighbour, ImageFolder)
# ──────────────────────────────────────────────────────────────

def _collect_paths_and_labels(root: str):
    img_paths, labels = [], []
    for label in sorted(os.listdir(root)):
        label_dir = os.path.join(root, label)
        if not os.path.isdir(label_dir):
            continue
        for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
            for p in glob(os.path.join(label_dir, ext)):
                img_paths.append(p)
                labels.append(label)
    return img_paths, labels


def _extract_embeddings(img_paths, backbone, device, transform):
    backbone.eval()
    embs = []
    with torch.no_grad():
        for p in img_paths:
            from PIL import Image as PILImage
            img = PILImage.open(p).convert("RGB")
            t = transform(img).unsqueeze(0).to(device)
            e = backbone(t)
            embs.append(e.squeeze(0).cpu().float().numpy())
    return np.stack(embs)


def evaluate_dataset(backbone, dataset_path: str, device, transform) -> float:
    """Nearest-neighbour cosine accuracy trên ImageFolder dataset."""
    if not os.path.isdir(dataset_path):
        logger.warning(f"Eval dataset không tồn tại: {dataset_path} → trả về 0.0")
        return 0.0

    img_paths, labels = _collect_paths_and_labels(dataset_path)
    if len(img_paths) == 0:
        logger.warning(f"Không có ảnh trong {dataset_path}")
        return 0.0

    embs = _extract_embeddings(img_paths, backbone, device, transform)
    sims = cosine_similarity(embs, embs)
    # Loại bỏ self-match
    np.fill_diagonal(sims, -1e6)
    preds_idx = np.argmax(sims, axis=1)
    pred_labels = [labels[i] for i in preds_idx]
    acc = float(np.mean([p == g for p, g in zip(pred_labels, labels)]))
    return acc


# ──────────────────────────────────────────────────────────────
# Training loop (dùng trong mỗi Optuna trial)
# ──────────────────────────────────────────────────────────────

def train_one_trial(fixed_cfg: dict, trial_params: dict, device: torch.device) -> float:
    """
    Huấn luyện một trial và trả về objective score.
    score = 2 × acc(special_test) + 1 × acc(lfw_decrease)
    """
    # ── Transform (không augmentation) ──────────────────────
    transform_eval = transforms.Compose([
        transforms.Resize((112, 112)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])
    transform_train = transforms.Compose([
        transforms.Resize((112, 112)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])

    # ── Dataset ─────────────────────────────────────────────
    dataset_path = os.path.join(ROOT_DIR, fixed_cfg["dataset_train_path"])
    train_dataset = datasets.ImageFolder(dataset_path, transform=transform_train)
    num_classes = len(train_dataset.classes)
    train_loader = DataLoader(
        train_dataset,
        batch_size=fixed_cfg["batch_size"],
        shuffle=True,
        num_workers=fixed_cfg.get("num_workers", 0),
        pin_memory=False,
        drop_last=True,
    )

    # ── Backbone ─────────────────────────────────────────────
    model_path = os.path.join(ROOT_DIR, fixed_cfg["model_path"])
    backbone = iresnet50(pretrained=False)
    state_dict = torch.load(model_path, map_location="cpu")
    backbone.load_state_dict(state_dict, strict=False)

    lora_r = trial_params["lora_r"]
    lora_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_r * 2,
        target_modules=fixed_cfg["lora_target_modules"],
        lora_dropout=trial_params["lora_dropout"],
        bias="none",
    )
    backbone = get_peft_model(backbone, lora_config)
    backbone = backbone.to(device)

    # ── Margin head ──────────────────────────────────────────
    m2 = trial_params["margin_m2"]
    margin_loss = CombinedMarginLoss(
        64,           # scale
        1.0,          # m1
        m2,           # m2  (tunable)
        0.0,          # m3
        fixed_cfg.get("interclass_filtering_threshold", 0),
    )
    module_partial_fc = PartialFC_V2_MPS(
        margin_loss=margin_loss,
        embedding_size=fixed_cfg["embedding_size"],
        num_classes=num_classes,
        sample_rate=fixed_cfg.get("sample_rate", 1.0),
        fp16=fixed_cfg.get("fp16", False),
        device=device,
    ).to(device)

    # ── Optimizer ────────────────────────────────────────────
    lr = trial_params["learning_rate"]
    wd = trial_params["weight_decay"]
    optimizer = torch.optim.AdamW(
        [{"params": backbone.parameters()}, {"params": module_partial_fc.parameters()}],
        lr=lr,
        weight_decay=wd,
    )

    epochs = fixed_cfg["epochs_per_trial"]
    lr_scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
        optimizer,
        T_0=max(1, len(train_loader) * 5),
        T_mult=1,
        eta_min=1e-7,
    )

    # ── Class center init ────────────────────────────────────
    backbone.eval()
    class_centers = torch.zeros(num_classes, fixed_cfg["embedding_size"], device=device)
    class_counts = torch.zeros(num_classes, device=device)
    with torch.no_grad():
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            e = backbone(images)
            for i in range(len(labels)):
                class_centers[labels[i]] += e[i]
                class_counts[labels[i]] += 1
    for i in range(num_classes):
        if class_counts[i] > 0:
            class_centers[i] /= class_counts[i]
            class_centers[i] = torch.nn.functional.normalize(class_centers[i], p=2, dim=0)
    module_partial_fc.weight.data = class_centers

    # ── Training loop ─────────────────────────────────────────
    head_warmup = trial_params["head_warmup_epochs"]
    loss_am = AverageMeter()

    for epoch in range(1, epochs + 1):
        is_warmup = epoch <= head_warmup
        if is_warmup:
            backbone.eval()
        else:
            backbone.train()
            for m in backbone.modules():
                if isinstance(m, (nn.BatchNorm2d, nn.BatchNorm1d)):
                    m.eval()
        module_partial_fc.train()
        loss_am.reset()
        epoch_start = time.time()

        for i, (images, labels_b) in enumerate(train_loader):
            images, labels_b = images.to(device), labels_b.to(device)
            optimizer.zero_grad()
            if is_warmup:
                with torch.no_grad():
                    emb = backbone(images)
            else:
                emb = backbone(images)
            loss = module_partial_fc(emb, labels_b)
            loss.backward()
            if not is_warmup:
                torch.nn.utils.clip_grad_norm_(backbone.parameters(), 5)
            optimizer.step()
            lr_scheduler.step(epoch - 1 + i / len(train_loader))
            loss_am.update(loss.item(), 1)

        epoch_time = time.time() - epoch_start
        warmup_tag = " [WARMUP]" if is_warmup else ""
        logger.info(
            f"  Epoch [{epoch}/{epochs}]{warmup_tag} | "
            f"Loss: {loss_am.avg:.4f} | "
            f"LR: {lr_scheduler.get_last_lr()[0]:.2e} | "
            f"Time: {epoch_time:.1f}s"
        )

    # ── Merge LoRA và evaluate ────────────────────────────────
    backbone.eval()
    merged = backbone.merge_and_unload()
    merged = merged.to(device)

    special_test_dir = os.path.join(ROOT_DIR, fixed_cfg["special_test_path"])
    lfw_dir = os.path.join(ROOT_DIR, fixed_cfg["lfw_decrease_path"])

    acc_special = evaluate_dataset(merged, special_test_dir, device, transform_eval)
    acc_lfw = evaluate_dataset(merged, lfw_dir, device, transform_eval)

    score = 2.0 * acc_special + 1.0 * acc_lfw
    logger.info(
        f"  special_test={acc_special:.4f}  lfw_decrease={acc_lfw:.4f}  "
        f"→ score={score:.4f}"
    )

    # FIX 1: Lưu state_dict rồi xóa model khỏi RAM/VRAM ngay
    merged_sd = merged.state_dict()
    del backbone, merged
    return score, acc_special, acc_lfw, merged_sd


# ──────────────────────────────────────────────────────────────
# Optuna objective
# ──────────────────────────────────────────────────────────────

def make_objective(fixed_cfg: dict, device: torch.device, best_state: dict):
    def objective(trial: optuna.Trial) -> float:
        trial_params = {
            "learning_rate": trial.suggest_float("learning_rate", 5e-5, 5e-4, log=True),
            "weight_decay": trial.suggest_float("weight_decay", 1e-4, 5e-2, log=True),
            "lora_r": trial.suggest_categorical("lora_r", [4, 8, 16, 32]),
            "lora_dropout": trial.suggest_float("lora_dropout", 0.0, 0.20),
            "head_warmup_epochs": trial.suggest_int("head_warmup_epochs", 1, 3),
            "margin_m2": trial.suggest_float("margin_m2", 0.20, 0.50),
        }

        logger.info(
            f"Trial {trial.number:3d} | "
            f"lr={trial_params['learning_rate']:.2e}  "
            f"wd={trial_params['weight_decay']:.2e}  "
            f"r={trial_params['lora_r']}  "
            f"dropout={trial_params['lora_dropout']:.2f}  "
            f"warmup={trial_params['head_warmup_epochs']}  "
            f"m2={trial_params['margin_m2']:.2f}"
        )

        try:
            score, acc_st, acc_lfw, state_dict = train_one_trial(
                fixed_cfg, trial_params, device
            )
        except Exception as e:
            logger.error(f"Trial {trial.number} failed: {e}")
            return 0.0
        finally:
            # FIX 2: Dọn dẹp bộ nhớ sau mỗi trial
            gc.collect()
            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
            elif torch.cuda.is_available():
                torch.cuda.empty_cache()

        # Lưu trạng thái best
        if score > best_state.get("score", -1.0):
            best_state["score"] = score
            best_state["params"] = copy.deepcopy(trial_params)
            best_state["acc_special_test"] = acc_st
            best_state["acc_lfw_decrease"] = acc_lfw

        return score

    return objective


# ──────────────────────────────────────────────────────────────
# Export best_config.yml
# ──────────────────────────────────────────────────────────────

def export_best_config(fixed_cfg: dict, best_params: dict, output_path: str):
    lora_r = best_params["lora_r"]
    config = {
        "# Fine-tune Config (Best từ HPO — cấu trúc giống train_config.yml)": None,

        # Paths
        "model_path": fixed_cfg["model_path"],
        "dataset_train_path": fixed_cfg["dataset_train_path"],
        "save_dir": "models/finetuned",

        # Training
        "batch_size": fixed_cfg["batch_size"],
        "epochs": 30,
        "head_warmup_epochs": best_params["head_warmup_epochs"],
        "learning_rate": round(best_params["learning_rate"], 8),
        "weight_decay": round(best_params["weight_decay"], 8),
        "optimizer": fixed_cfg.get("optimizer", "adamw"),
        "num_workers": fixed_cfg.get("num_workers", 0),
        "fp16": fixed_cfg.get("fp16", True),
        "gradient_acc": fixed_cfg.get("gradient_acc", 1),

        # LoRA
        "use_lora": True,
        "lora_r": lora_r,
        "lora_alpha": lora_r * 2,
        "lora_dropout": round(best_params["lora_dropout"], 4),
        "lora_target_modules": fixed_cfg["lora_target_modules"],

        # ArcFace
        "embedding_size": fixed_cfg["embedding_size"],
        "sample_rate": fixed_cfg.get("sample_rate", 1.0),
        "margin_list": [1.0, round(best_params["margin_m2"], 4), 0.0],
        "interclass_filtering_threshold": fixed_cfg.get("interclass_filtering_threshold", 0),

        # Logging
        "verbose": 10,
        "val_targets": [],
        "using_wandb": False,
    }

    # Loại bỏ key comment giả
    config.pop("# Fine-tune Config (Best từ HPO — cấu trúc giống train_config.yml)", None)

    lines = ["# Fine-tune Config (Best từ Optuna HPO)\n", "\n"]
    groups = [
        ("# --- Model & Dataset Paths ---", ["model_path", "dataset_train_path", "save_dir"]),
        ("# --- Training Hyperparameters ---", [
            "batch_size", "epochs", "head_warmup_epochs", "learning_rate",
            "weight_decay", "optimizer", "num_workers", "fp16", "gradient_acc"
        ]),
        ("# --- LoRA Hyperparameters ---", [
            "use_lora", "lora_r", "lora_alpha", "lora_dropout", "lora_target_modules"
        ]),
        ("# --- ArcFace / CosFace Margin Head (PartialFC) ---", [
            "embedding_size", "sample_rate", "margin_list", "interclass_filtering_threshold"
        ]),
        ("# --- Logging & Validation ---", ["verbose", "val_targets", "using_wandb"]),
    ]

    for header, keys in groups:
        lines.append(header + "\n")
        for k in keys:
            v = config[k]
            if isinstance(v, str):
                lines.append(f'{k}: "{v}"\n')
            elif isinstance(v, bool):
                lines.append(f"{k}: {'true' if v else 'false'}\n")
            else:
                lines.append(f"{k}: {v}\n")
        lines.append("\n")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

    logger.info(f"✅ best_config.yml đã lưu tại: {output_path}")


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Optuna HPO cho InsightFace LoRA fine-tuning")
    parser.add_argument(
        "config",
        nargs="?",
        default="train_with_hyperparam_tune_fixed_config.yml",
        help="Path tới fixed config YAML",
    )
    args = parser.parse_args()

    fixed_cfg = load_yaml(args.config)
    device = get_device()
    logger.info(f"✅ Device: {device}")
    logger.info(f"✅ Số trials: {fixed_cfg['n_trials']}, epochs/trial: {fixed_cfg['epochs_per_trial']}")

    best_state: dict = {"score": -1.0}

    study = optuna.create_study(
        study_name=fixed_cfg["study_name"],
        direction=fixed_cfg.get("direction", "maximize"),
        sampler=TPESampler(seed=42),
    )

    study.optimize(
        make_objective(fixed_cfg, device, best_state),
        n_trials=fixed_cfg["n_trials"],
        show_progress_bar=True,
    )

    # ── Tổng kết ────────────────────────────────────────────
    best_trial = study.best_trial
    logger.info("\n" + "=" * 60)
    logger.info(f"✅ HOÀN TẤT {fixed_cfg['n_trials']} trials")
    logger.info(f"   Best score     : {best_trial.value:.4f}")
    logger.info(f"   special_test   : {best_state.get('acc_special_test', 'N/A'):.4f}")
    logger.info(f"   lfw_decrease   : {best_state.get('acc_lfw_decrease', 'N/A'):.4f}")
    logger.info(f"   Best params    : {best_trial.params}")
    logger.info("=" * 60)

    # ── Export best_config.yml ───────────────────────────────
    best_config_path = os.path.join(ROOT_DIR, fixed_cfg["best_config_path"])
    export_best_config(fixed_cfg, best_state["params"], best_config_path)

    # ── In top-5 trials ──────────────────────────────────────
    top5 = sorted(study.trials, key=lambda t: t.value if t.value is not None else -1, reverse=True)[:5]
    logger.info("\nTop-5 trials:")
    for i, t in enumerate(top5, 1):
        logger.info(f"  #{i}  score={t.value:.4f}  params={t.params}")


if __name__ == "__main__":
    main()
