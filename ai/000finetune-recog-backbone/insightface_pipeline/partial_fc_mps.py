import math
from typing import Callable
import torch
from torch import distributed
from torch.nn.functional import linear, normalize

class PartialFC_V2_MPS(torch.nn.Module):
    def __init__(
        self,
        margin_loss: Callable,
        embedding_size: int,
        num_classes: int,
        sample_rate: float = 1.0,
        fp16: bool = False,
        device=None
    ):
        super(PartialFC_V2_MPS, self).__init__()
        self.device = device if device else torch.device('cpu')
        
        # Single GPU / MPS setup
        self.rank = 0
        self.world_size = 1

        self.embedding_size = embedding_size
        self.sample_rate: float = sample_rate
        self.fp16 = fp16
        self.num_local: int = num_classes
        self.class_start: int = 0
        self.num_sample: int = int(self.sample_rate * self.num_local)

        self.weight = torch.nn.Parameter(torch.normal(0, 0.01, (self.num_local, embedding_size)))

        # margin_loss
        if isinstance(margin_loss, Callable):
            self.margin_softmax = margin_loss
        else:
            raise ValueError()

    def sample(self, labels, index_positive):
        with torch.no_grad():
            positive = torch.unique(labels[index_positive], sorted=True).to(self.device)
            if self.num_sample - positive.size(0) >= 0:
                perm = torch.rand(size=[self.num_local]).to(self.device)
                perm[positive] = 2.0
                index = torch.topk(perm, k=self.num_sample)[1].to(self.device)
                index = index.sort()[0].to(self.device)
            else:
                index = positive
            self.weight_index = index
            labels[index_positive] = torch.searchsorted(index, labels[index_positive])
        return self.weight[self.weight_index]

    def forward(
        self,
        embeddings: torch.Tensor,
        labels: torch.Tensor,
    ):
        labels.squeeze_()
        labels = labels.long()

        index_positive = (self.class_start <= labels) & (
            labels < self.class_start + self.num_local
        )
        labels[~index_positive] = -1
        labels[index_positive] -= self.class_start

        if self.sample_rate < 1:
            weight = self.sample(labels, index_positive)
        else:
            weight = self.weight

        # Normalize
        norm_embeddings = normalize(embeddings)
        norm_weight_activated = normalize(weight)
        
        logits = linear(norm_embeddings, norm_weight_activated)
        
        if self.fp16 and logits.dtype != torch.float32:
            logits = logits.float()
            
        logits = logits.clamp(-1, 1)

        # Calculate Margin and CrossEntropy
        logits = self.margin_softmax(logits, labels)
        
        # Standard CrossEntropy
        loss = torch.nn.functional.cross_entropy(logits, labels)
        return loss
