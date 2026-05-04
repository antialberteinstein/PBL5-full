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
    
    # InsightFace transforms
    transform = transforms.Compose([
        transforms.Resize((112, 112)),
        transforms.RandomHorizontalFlip(),
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
    print("✅ Pretrained weights loaded.")

    # 3. Gắn LoRA
    if config.get('use_lora', True):
        lora_config = LoraConfig(
            r=config['lora_r'],
            lora_alpha=config.get('lora_alpha', 16),
            target_modules=r".*conv.*", 
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

    lr_scheduler = PolynomialLRWarmup(
        optimizer=optimizer,
        warmup_iters=warmup_step,
        total_iters=total_step
    )

    # 6. Vòng lặp huấn luyện
    print(f"\n🚀 Bắt đầu huấn luyện InsightFace Pipeline ({epochs} Epochs)...")
    
    amp = torch.cuda.amp.grad_scaler.GradScaler(enabled=config.get('fp16', False)) if torch.cuda.is_available() else None
    loss_am = AverageMeter()
    global_step = 0

    for epoch in range(1, epochs + 1):
        backbone.train()
        module_partial_fc.train()
        
        start_time = time.time()
        for i, (images, labels) in enumerate(train_loader):
            global_step += 1
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()

            if amp is not None and torch.cuda.is_available():
                with torch.cuda.amp.autocast():
                    embeddings = backbone(images)
                    loss = module_partial_fc(embeddings, labels)
                amp.scale(loss).backward()
                torch.nn.utils.clip_grad_norm_(backbone.parameters(), 5)
                amp.step(optimizer)
                amp.update()
            else:
                embeddings = backbone(images)
                loss = module_partial_fc(embeddings, labels)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(backbone.parameters(), 5)
                optimizer.step()

            lr_scheduler.step()
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
