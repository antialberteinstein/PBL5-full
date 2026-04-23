from __future__ import annotations

from pathlib import Path
import sys

import torch
from torch import nn
from torch.nn import functional as F
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from model import ConvNextV2NanoClassifier
from config import FACE_CROP_SIZE

def _coerce_value(raw: str):
    value = raw.strip().strip("\"'")
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value

def load_config(path: Path) -> dict:
    config: dict = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        config[key.strip()] = _coerce_value(raw)
    return config

def build_dataloaders(
    data_dir: Path,
    batch_size: int,
    val_split: float,
    num_workers: int,
):
    # Sử dụng chuẩn Normalize của ImageNet vì ta dùng Pretrained Weights của ImageNet
    transform = transforms.Compose([
        transforms.Resize(FACE_CROP_SIZE),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    dataset = datasets.ImageFolder(data_dir.as_posix(), transform=transform)
    val_size = int(len(dataset) * val_split)
    train_size = len(dataset) - val_size

    if val_size > 0:
        train_ds, val_ds = random_split(dataset, [train_size, val_size])
    else:
        train_ds, val_ds = dataset, None

    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
    )
    val_loader = None
    if val_ds is not None:
        val_loader = DataLoader(
            val_ds,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=True,
        )

    return dataset, train_loader, val_loader

def run_epoch(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    optimizer: torch.optim.Optimizer | None = None,
):
    is_train = optimizer is not None
    model.train(is_train)

    total_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        if is_train:
            optimizer.zero_grad(set_to_none=True)

        logits = model(images)
        loss = F.cross_entropy(logits, labels)

        if is_train:
            loss.backward()
            optimizer.step()

        total_loss += loss.item() * images.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += images.size(0)

    avg_loss = total_loss / max(1, total)
    acc = correct / max(1, total)
    return avg_loss, acc

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Train EfficientNet-B0 Softmax Classifier")
    parser.add_argument("--config_path", default="convnextv2-nano-softmax/train_config.yml", help="Path to config yml")
    args = parser.parse_args()

    config_path = Path(args.config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config not found: {config_path}")
    config = load_config(config_path)

    data_dir = Path(config.get("data_dir", "dataset/anti-spoofing-rebuilt-cropped"))
    save_dir = Path(config.get("save_dir", "models/anti_spoofing/convnextv2_nano_softmax"))
    save_dir.mkdir(parents=True, exist_ok=True)

    # Tự động chọn thiết bị mps nếu có trên Mac, hoặc cuda, hoặc fallback về cpu
    if torch.cuda.is_available():
        default_device = "cuda"
    elif torch.backends.mps.is_available():
        default_device = "mps"
    else:
        default_device = "cpu"
        
    device_name = config.get("device", default_device)
    epochs = int(config.get("epochs", 15))
    batch_size = int(config.get("batch_size", 32))
    lr = float(config.get("lr", 1e-3))
    weight_decay = float(config.get("weight_decay", 1e-4))
    val_split = float(config.get("val_split", 0.2))
    num_workers = int(config.get("num_workers", 2))

    dataset, train_loader, val_loader = build_dataloaders(
        data_dir, batch_size, val_split, num_workers
    )
    device = torch.device(device_name)
    print(f"Training on device: {device}")

    num_classes = len(dataset.classes)
    model = ConvNextV2NanoClassifier(num_classes=num_classes, pretrained=True).to(device)

    # Áp dụng L2 Regularization thông qua weight_decay của AdamW
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)

    print(f"Classes ({num_classes}): {dataset.classes}")
    
    best_val_acc = 0.0
    for epoch in range(1, epochs + 1):
        train_loss, train_acc = run_epoch(
            model, train_loader, device, optimizer=optimizer
        )
        print(f"Epoch {epoch:02d}/{epochs} | Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f}")

        if val_loader is not None:
            val_loss, val_acc = run_epoch(model, val_loader, device)
            print(f"Epoch {epoch:02d}/{epochs} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}")
            
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                ckpt = {
                    "epoch": epoch,
                    "model_state": model.state_dict(),
                    "classes": dataset.classes,
                    "val_acc": val_acc
                }
                ckpt_path = save_dir / "convnextv2_nano_softmax_best.pt"
                torch.save(ckpt, ckpt_path)
                print(f"-> Saved best model to {ckpt_path}")

        if epoch == epochs:
            ckpt = {
                "epoch": epoch,
                "model_state": model.state_dict(),
                "classes": dataset.classes,
            }
            ckpt_path = save_dir / "efficientnet_b0_softmax_last.pt"
            torch.save(ckpt, ckpt_path)

if __name__ == "__main__":
    main()
