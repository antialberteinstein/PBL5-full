import os
import sys
import yaml
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from torch.utils.tensorboard import SummaryWriter

from peft import LoraConfig, get_peft_model

# Thêm đường dẫn tới insightface_pipeline
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backbone.iresnet import iresnet50
from insightface_pipeline.losses import CombinedMarginLoss
from insightface_pipeline.partial_fc_mps import PartialFC_V2_MPS
from insightface_pipeline.lr_scheduler import PolynomialLRWarmup
from insightface_pipeline.utils.utils_logging import AverageMeter

def load_config(config_path: str) -> dict:
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

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
    dataset_path = os.path.join(ROOT_DIR, config['dataset_train_path'])
    print(f"Loading dataset from: {dataset_path}")
    
    # InsightFace transforms với aggressive augmentation để chống overfit trên dataset nhỏ
    transform = transforms.Compose([
        transforms.Resize((128, 128)),              # Resize lớn hơn để crop ngẫu nhiên
        transforms.RandomCrop((112, 112)),          # Random crop để tạo đa dạng vùng ảnh
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(                     # Biến đổi màu sắc ngẫu nhiên (ánh sáng, tương phản, màu sắc)
            brightness=0.3,
            contrast=0.3,
            saturation=0.2,
            hue=0.05
        ),
        transforms.RandomGrayscale(p=0.05),        # 5% ảnh đổi thành đen trắng (tăng robustness)
        transforms.RandomAffine(                   # Xoay nhẹ và dịch chuyển
            degrees=10,
            translate=(0.05, 0.05),
            scale=(0.9, 1.1)
        ),
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
        num_workers=config.get('num_workers', 2),
        pin_memory=True,
        drop_last=True
    )

    # 2. Xây dựng mô hình Backbone IResNet50
    model_path = os.path.join(ROOT_DIR, config['model_path'])
    backbone = iresnet50(pretrained=False)
    
    print(f"Loading pretrained weights from {model_path}...")
    state_dict = torch.load(model_path, map_location='cpu')
    backbone.load_state_dict(state_dict, strict=False)
    # 3. Gắn LoRA
    if config.get('use_lora', True):
        lora_config = LoraConfig(
            r=config['lora_r'],
            lora_alpha=config.get('lora_alpha', 16),
            target_modules=config.get('lora_target_modules', ["fc"]), 
            lora_dropout=config.get('lora_dropout', 0.05),
            bias="none",
        )
        backbone = get_peft_model(backbone, lora_config)
        backbone.print_trainable_parameters()
    
    backbone = backbone.to(device)

    # 4. Đầu InsightFace PartialFC_V2 (MPS/CPU/CUDA compatible)
    margin_list = config.get('margin_list', [1.0, 0.5, 0.0])
    margin_loss = CombinedMarginLoss(
        64, # scale
        margin_list[0],
        margin_list[1],
        margin_list[2],
        config.get('interclass_filtering_threshold', 0)
    )

    module_partial_fc = PartialFC_V2_MPS(
        margin_loss=margin_loss,
        embedding_size=config.get('embedding_size', 512),
        num_classes=num_classes,
        sample_rate=config.get('sample_rate', 1.0),
        fp16=config.get('fp16', False),
        device=device
    ).to(device)

    # 5. Optimizer & LR Scheduler
    opt_type = config.get('optimizer', 'adamw').lower()
    lr = config['learning_rate']
    weight_decay = config['weight_decay']

    params = [
        {"params": backbone.parameters()}, 
        {"params": module_partial_fc.parameters()}
    ]

    if opt_type == 'sgd':
        optimizer = torch.optim.SGD(params, lr=lr, momentum=0.9, weight_decay=weight_decay)
    else:
        optimizer = torch.optim.AdamW(params, lr=lr, weight_decay=weight_decay)

    epochs = config['epochs']
    total_step = len(train_loader) * epochs
    warmup_step = len(train_loader) * config.get('warmup_epoch', 0)

    # Dùng CosineAnnealingWarmRestarts để LR dao động theo chu kỳ (giúp thoát khỏi điểm saddle tốt hơn)
    lr_scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
        optimizer,
        T_0=len(train_loader) * 5,   # Restart sau mỗi 5 epoch
        T_mult=1,
        eta_min=1e-6
    )

    # === 6. CLASS CENTER INITIALIZATION ===
    amp = torch.cuda.amp.grad_scaler.GradScaler(enabled=config.get('fp16', False)) if torch.cuda.is_available() else None
    
    # Khởi tạo trọng số phân loại (module_partial_fc.weight) bằng Mean Embeddings của Pretrained Backbone
    # Điều này tránh việc PartialFC khởi tạo ngẫu nhiên gây sốc gradient phá hỏng backbone
    print("\nKhởi tạo Class Centers từ Pretrained Backbone để tránh sốc Gradient...")
    backbone.eval()
    class_centers = torch.zeros(num_classes, config.get('embedding_size', 512), device=device)
    class_counts = torch.zeros(num_classes, device=device)
    
    with torch.no_grad():
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            if amp is not None and torch.cuda.is_available():
                with torch.cuda.amp.autocast():
                    embeddings = backbone(images)
            else:
                embeddings = backbone(images)
            
            for i in range(len(labels)):
                class_centers[labels[i]] += embeddings[i]
                class_counts[labels[i]] += 1
                
    # Tính trung bình và chuẩn hóa
    for i in range(num_classes):
        if class_counts[i] > 0:
            class_centers[i] /= class_counts[i]
            class_centers[i] = torch.nn.functional.normalize(class_centers[i], p=2, dim=0)
            
    # Gán vào PartialFC
    module_partial_fc.weight.data = class_centers
    print("✅ Đã đồng bộ không gian Vector từ Pretrained sang Classifier Head.")

    # 7. Vòng lặp huấn luyện
    print(f"\n🚀 Bắt đầu huấn luyện InsightFace Pipeline ({epochs} Epochs)...")
    
    loss_am = AverageMeter()
    global_step = 0

    head_warmup_epochs = config.get('head_warmup_epochs', 2)

    for epoch in range(1, epochs + 1):
        is_warmup = epoch <= head_warmup_epochs
        if is_warmup:
            backbone.eval()
            if epoch == 1:
                print(f"⚠️ [WARMUP] Đóng băng Backbone trong {head_warmup_epochs} epoch đầu để hội tụ Head.")
        else:
            backbone.train()
            # Bắt buộc đóng băng BatchNorm để tránh hỏng pretrained weights khi finetune trên dataset nhỏ
            for module in backbone.modules():
                if isinstance(module, torch.nn.BatchNorm2d) or isinstance(module, torch.nn.BatchNorm1d):
                    module.eval()
            
        module_partial_fc.train()
        
        start_time = time.time()
        for i, (images, labels) in enumerate(train_loader):
            global_step += 1
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            
            if amp is not None and torch.cuda.is_available():
                with torch.cuda.amp.autocast():
                    if is_warmup:
                        with torch.no_grad():
                            embeddings = backbone(images)
                    else:
                        embeddings = backbone(images)
                        
                    loss = module_partial_fc(embeddings, labels)
                    
                amp.scale(loss).backward()
                if not is_warmup:
                    torch.nn.utils.clip_grad_norm_(backbone.parameters(), 5)
                amp.step(optimizer)
                amp.update()
            else:
                if is_warmup:
                    with torch.no_grad():
                        embeddings = backbone(images)
                else:
                    embeddings = backbone(images)
                    
                loss = module_partial_fc(embeddings, labels)
                
                loss.backward()
                if not is_warmup:
                    torch.nn.utils.clip_grad_norm_(backbone.parameters(), 5)
                optimizer.step()

            # CosineAnnealingWarmRestarts cần step(epoch + i/len(loader)) để mượt mà
            lr_scheduler.step(epoch - 1 + i / len(train_loader))
            loss_am.update(loss.item(), 1)
            
            if global_step % config.get('verbose', 10) == 0:
                print(f"Epoch [{epoch}/{epochs}] Step [{global_step}/{total_step}] | "
                      f"Loss: {loss_am.avg:.4f} | LR: {lr_scheduler.get_last_lr()[0]:.6f}")

        epoch_time = time.time() - start_time
        print(f"--- Epoch {epoch} completed in {epoch_time:.2f}s ---\n")

    print("\n✅ Huấn luyện hoàn tất!")

    # 7. Merge LoRA & Xuất Model
    if config.get('use_lora', True):
        print("Tiến hành gộp trọng số LoRA vào Backbone...")
        backbone.eval()
        merged_backbone = backbone.merge_and_unload()
    else:
        merged_backbone = backbone

    save_dir = os.path.join(ROOT_DIR, config['save_dir'])
    os.makedirs(save_dir, exist_ok=True)
    
    pth_out_path = os.path.join(save_dir, "w600k_r50.pth")
    torch.save(merged_backbone.state_dict(), pth_out_path)
    print(f"✅ Đã lưu trọng số PTH tại: {pth_out_path}")
    
    onnx_out_path = os.path.join(save_dir, "w600k_r50.onnx")
    
    # Bắt buộc chuyển model và tensor về CPU trước khi xuất ONNX trên Mac (tránh lỗi file bị rỗng/lỗi Protobuf của MPS)
    merged_backbone = merged_backbone.cpu()
    dummy_input = torch.randn(1, 3, 112, 112, device="cpu")
    
    try:
        torch.onnx.export(
            merged_backbone, dummy_input, onnx_out_path,
            input_names=['data'], output_names=['fc1'],
            opset_version=14, do_constant_folding=True
        )
        
        # Consolidate external data (if any) into a single ONNX file for InsightFace compatibility
        import onnx
        model_onnx = onnx.load(onnx_out_path, load_external_data=True)
        if os.path.exists(onnx_out_path + ".data"):
            os.remove(onnx_out_path + ".data")
            os.remove(onnx_out_path)
            onnx.save_model(model_onnx, onnx_out_path, save_as_external_data=False)
            
        print(f"✅ Đã xuất ONNX thành công tại: {onnx_out_path}")
    except Exception as e:
        print(f"❌ Lỗi xuất ONNX: {e}")

if __name__ == "__main__":
    main()
