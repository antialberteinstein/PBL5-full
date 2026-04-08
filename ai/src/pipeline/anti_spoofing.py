"""
Pipeline wrapper for FFT-based anti-spoofing.
"""

from dataclasses import dataclass
from typing import Dict

import numpy as np

from anti_spoofing.fft_detector import FFTAntiSpoofing, FFTAntiSpoofingConfig, FFTAntiSpoofingResult


@dataclass
class AntiSpoofingResult:
	is_spoof: bool
	score: float
	metrics: Dict[str, float]


class AntiSpoofingPipeline:
	"""High-level interface for anti-spoofing checks."""

	def __init__(self, config: FFTAntiSpoofingConfig | None = None):
		self.detector = FFTAntiSpoofing(config)

	def predict(self, frame: np.ndarray) -> AntiSpoofingResult:
		result: FFTAntiSpoofingResult = self.detector.analyze(frame)
		return AntiSpoofingResult(
			is_spoof=result.is_spoof,
			score=result.score,
			metrics=result.metrics,
		)
