import timm
import torch
from torch import nn

class ConvNextV2NanoClassifier(nn.Module):
    def __init__(self, num_classes: int, pretrained: bool = True):
        super().__init__()
        self.backbone = timm.create_model(
            "convnextv2_nano.fcmae_ft_in22k_in1k",
            pretrained=pretrained,
            num_classes=num_classes,
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Trả về raw logits (Softmax sẽ được xử lý ngầm định bên trong F.cross_entropy)
        return self.backbone(x)
