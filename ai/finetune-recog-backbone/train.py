import os
import sys
import yaml
import time
import math
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import torchvision

from peft import LoraConfig, get_peft_model

# Add current directory to path so we can import models.iresnet
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backbone.iresnet import iresnet50

def load_config(config_path: str) -> dict:
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

class ArcMarginProduct(nn.Module):
    """
    ArcFace (Additive Angular Margin Loss) Head
    """
    def __init__(self, in_features, out_features, s=32.0, m=0.50, easy_margin=False):
        super(ArcMarginProduct, self).__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.s = s
        self.m = m
        self.weight = nn.Parameter(torch.FloatTensor(out_features, in_features))
        nn.init.xavier_uniform_(self.weight)

        self.easy_margin = easy_margin
        self.cos_m = math.cos(m)
        self.sin_m = math.sin(m)
        self.th = math.cos(math.pi - m)
        self.mm = math.sin(math.pi - m) * m

    def forward(self, input, label):
        # --------------------------- cos(theta) & phi(theta) ---------------------------
        cosine = F.linear(F.normalize(input), F.normalize(self.weight))
        sine = torch.sqrt((1.0 - torch.pow(cosine, 2)).clamp(0, 1))
        phi = cosine * self.cos_m - sine * self.sin_m
        if self.easy_margin:
            phi = torch.where(cosine > 0, phi, cosine)
        else:
            phi = torch.where(cosine > self.th, phi, cosine - self.mm)
        # --------------------------- convert label to one-hot ---------------------------
        one_hot = torch.zeros(cosine.size(), device=input.device)
        one_hot.scatter_(1, label.view(-1, 1).long(), 1)
        # -------------torch.where(out_i = {x_i if condition_i else y_i) -------------
        output = (one_hot * phi) + ((1.0 - one_hot) * cosine)
        output *= self.s
        return output

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("config", nargs="?", default="train_config.yml", help="Path to config YAML")
    args = parser.parse_args()

    config = load_config(args.config)
    
    # Thiết lập device
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"✅ Using device: {device}")

    # 1. Dataset & Dataloader
    dataset_path = os.path.join(ROOT_DIR, config['dataset_path'])
    print(f"Loading dataset from: {dataset_path}")
    
    # InsightFace chuẩn hóa bằng (img - 127.5)/128, tương đương với ToTensor rồi Normalize 0.5
    transform = transforms.Compose([
        transforms.Resize((112, 112)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
    ])
    
    train_dataset = datasets.ImageFolder(dataset_path, transform=transform)
    num_classes = len(train_dataset.classes)
    print(f"✅ Classes found ({num_classes}): {train_dataset.classes}")
    
    train_loader = DataLoader(
        train_dataset, 
        batch_size=config['batch_size'], 
        shuffle=True, 
        num_workers=4 if device.type != "mps" else 0, # Tránh lỗi DataLoader trên Mac MPS
        pin_memory=True
    )

    # 2. Xây dựng mô hình Backbone IResNet50
    model_path = os.path.join(ROOT_DIR, config['model_path'])
    backbone = iresnet50(pretrained=False)
    
    print(f"Loading pretrained weights from {model_path}...")
    state_dict = torch.load(model_path, map_location='cpu')
    backbone.load_state_dict(state_dict, strict=False)
    print("✅ Pretrained weights loaded.")

    # 3. Gắn LoRA bằng PEFT
    lora_config = LoraConfig(
        r=config['lora_r'],
        lora_alpha=config.get('lora_alpha', 16),
        target_modules=r".*conv.*", # Target tất cả các lớp convolution
        lora_dropout=config.get('lora_dropout', 0.05),
        bias="none",
    )
    
    lora_backbone = get_peft_model(backbone, lora_config)
    lora_backbone.print_trainable_parameters()
    lora_backbone = lora_backbone.to(device)

    # 4. Đầu ArcFace Margin (Tính toán Loss)
    margin_head = ArcMarginProduct(
        in_features=512, 
        out_features=num_classes, 
        s=config['scale'], 
        m=config['margin']
    ).to(device)

    # 5. Optimizer & Loss
    # Train cả LoRA backbone và Head
    optimizer = torch.optim.AdamW(
        list(lora_backbone.parameters()) + list(margin_head.parameters()),
        lr=config['learning_rate'],
        weight_decay=config['weight_decay']
    )
    criterion = nn.CrossEntropyLoss()

    # 6. Vòng lặp huấn luyện
    epochs = config['epochs']
    print(f"\n🚀 Bắt đầu huấn luyện ({epochs} Epochs)...")
    
    for epoch in range(1, epochs + 1):
        lora_backbone.train()
        margin_head.train()
        
        total_loss = 0.0
        correct = 0
        total = 0
        
        start_time = time.time()
        for i, (images, labels) in enumerate(train_loader):
            images, labels = images.to(device), labels.to(device)
            
            # Forward
            optimizer.zero_grad()
            embeddings = lora_backbone(images)
            outputs = margin_head(embeddings, labels)
            loss = criterion(outputs, labels)
            
            # Backward
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            
            # Tính accuracy (trên tập train)
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
        epoch_time = time.time() - start_time
        epoch_loss = total_loss / len(train_loader)
        epoch_acc = 100 * correct / total
        
        print(f"Epoch [{epoch}/{epochs}] | Loss: {epoch_loss:.4f} | Acc: {epoch_acc:.2f}% | Time: {epoch_time:.2f}s")

    print("\n✅ Huấn luyện hoàn tất!")

    # 7. Merge LoRA weights & Xuất ONNX
    print("Tiến hành gộp trọng số LoRA vào Backbone...")
    lora_backbone.eval()
    merged_backbone = lora_backbone.merge_and_unload()
    
    save_dir = os.path.join(ROOT_DIR, config['save_dir'])
    os.makedirs(save_dir, exist_ok=True)
    
    # Save PTH
    pth_out_path = os.path.join(save_dir, "r50_lora_finetuned.pth")
    torch.save(merged_backbone.state_dict(), pth_out_path)
    print(f"✅ Đã lưu trọng số PTH tại: {pth_out_path}")
    
    # Save ONNX
    onnx_out_path = os.path.join(save_dir, "r50_lora_finetuned.onnx")
    dummy_input = torch.randn(1, 3, 112, 112, device=device)
    
    try:
        torch.onnx.export(
            merged_backbone,
            dummy_input,
            onnx_out_path,
            input_names=['data'],
            output_names=['fc1'],
            opset_version=14,
            do_constant_folding=True
        )
        print(f"✅ Đã xuất mô hình ONNX thành công tại: {onnx_out_path}")
    except Exception as e:
        print(f"❌ Lỗi khi xuất ONNX: {e}")

if __name__ == "__main__":
    main()
