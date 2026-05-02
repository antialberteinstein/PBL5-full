import torch
from torch import nn
from torchvision import models

class ResNet50Classifier(nn.Module):
    def __init__(self, num_classes: int, pretrained: bool = True):
        super().__init__()
        weights = models.ResNet50_Weights.IMAGENET1K_V1 if pretrained else None
        self.backbone = models.resnet50(weights=weights)
        
        in_features = self.backbone.fc.in_features
        # Thay thế lớp fc gốc bằng một Linear layer mới cho Anti-Spoofing
        self.backbone.fc = nn.Linear(in_features, num_classes)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Trả về raw logits (Softmax sẽ được xử lý ngầm định bên trong F.cross_entropy)
        return self.backbone(x)
