import torch
from torch import nn
from torchvision import models

class ConvNextClassifier(nn.Module):
    def __init__(self, num_classes: int, pretrained: bool = True):
        super().__init__()
        weights = models.ConvNeXt_Tiny_Weights.IMAGENET1K_V1 if pretrained else None
        self.backbone = models.convnext_tiny(weights=weights)
        
        in_features = self.backbone.classifier[2].in_features
        # Thay thế lớp classifier gốc bằng một Linear layer mới cho Anti-Spoofing
        self.backbone.classifier[2] = nn.Linear(in_features, num_classes)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Trả về raw logits (Softmax sẽ được xử lý ngầm định bên trong F.cross_entropy)
        return self.backbone(x)
