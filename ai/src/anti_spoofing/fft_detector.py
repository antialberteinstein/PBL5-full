"""
FFT-based anti-spoofing heuristics.

Detects spoof artifacts by inspecting high-frequency energy, abnormal peaks,
and spikes in the spectrum.
"""

from dataclasses import dataclass
from typing import Dict

import numpy as np

try:
    import cv2
except ImportError:  # Fallback: allow usage without OpenCV for unit tests
    cv2 = None


@dataclass
class FFTAntiSpoofingConfig:
    resize: int = 224
    high_freq_ratio_cutoff: float = 0.65
    high_freq_energy_threshold: float = 0.42
    peak_min_radius: float = 0.35
    peak_threshold: float = 0.78
    peak_density_threshold: float = 0.003
    spike_threshold: float = 0.92
    score_threshold: float = 0.6
    weight_energy: float = 0.45
    weight_peaks: float = 0.35
    weight_spike: float = 0.2


@dataclass
class FFTAntiSpoofingResult:
    is_spoof: bool
    score: float
    metrics: Dict[str, float]


class FFTAntiSpoofing:
    """FFT-based detector for screen replay artifacts."""

    def __init__(self, config: FFTAntiSpoofingConfig | None = None):
        self.config = config or FFTAntiSpoofingConfig()

    def analyze(self, frame: np.ndarray) -> FFTAntiSpoofingResult:
        """Analyze a BGR/RGB frame and return anti-spoofing metrics."""
        gray = self._to_grayscale(frame)
        if gray is None:
            return FFTAntiSpoofingResult(
                is_spoof=False,
                score=0.0,
                metrics={"error": 1.0},
            )

        spectrum = self._fft_spectrum(gray)
        metrics = self._compute_metrics(spectrum)
        score = self._compute_score(metrics)

        is_spoof = (
            metrics["high_freq_energy_ratio"] >= self.config.high_freq_energy_threshold
            or metrics["peak_density"] >= self.config.peak_density_threshold
            or metrics["spike_score"] >= self.config.spike_threshold
            or score >= self.config.score_threshold
        )

        return FFTAntiSpoofingResult(
            is_spoof=is_spoof,
            score=score,
            metrics=metrics,
        )

    def _to_grayscale(self, frame: np.ndarray) -> np.ndarray | None:
        if frame is None:
            return None

        if frame.ndim == 2:
            gray = frame
        else:
            if cv2 is None:
                return None
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        if cv2 is not None:
            gray = cv2.resize(gray, (self.config.resize, self.config.resize))
        else:
            gray = self._simple_resize(gray, self.config.resize)

        return gray.astype(np.float32) / 255.0

    def _simple_resize(self, gray: np.ndarray, size: int) -> np.ndarray:
        """Nearest-neighbor resize fallback when OpenCV is not available."""
        h, w = gray.shape[:2]
        y_idx = (np.linspace(0, h - 1, size)).astype(np.int64)
        x_idx = (np.linspace(0, w - 1, size)).astype(np.int64)
        return gray[np.ix_(y_idx, x_idx)]

    def _fft_spectrum(self, gray: np.ndarray) -> np.ndarray:
        h, w = gray.shape
        window = np.outer(np.hanning(h), np.hanning(w))
        windowed = gray * window

        fft = np.fft.fft2(windowed)
        fft_shift = np.fft.fftshift(fft)
        magnitude = np.abs(fft_shift)
        return np.log1p(magnitude)

    def _compute_metrics(self, spectrum: np.ndarray) -> Dict[str, float]:
        h, w = spectrum.shape
        min_val = float(np.min(spectrum))
        max_val = float(np.max(spectrum))
        spectrum_norm = (spectrum - min_val) / (max_val - min_val + 1e-6)

        y, x = np.indices((h, w))
        cy, cx = h // 2, w // 2
        r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        r_norm = r / (r.max() + 1e-6)

        high_mask = r_norm >= self.config.high_freq_ratio_cutoff
        peak_mask = r_norm >= self.config.peak_min_radius

        energy_total = float(np.sum(spectrum ** 2)) + 1e-6
        energy_high = float(np.sum((spectrum ** 2) * high_mask))
        high_freq_energy_ratio = energy_high / energy_total

        peak_density, peak_count = self._count_peaks(spectrum_norm, peak_mask)
        spike_score = float(np.max(spectrum_norm[high_mask])) if np.any(high_mask) else 0.0

        return {
            "high_freq_energy_ratio": high_freq_energy_ratio,
            "peak_density": peak_density,
            "peak_count": float(peak_count),
            "spike_score": spike_score,
        }

    def _count_peaks(self, spectrum_norm: np.ndarray, mask: np.ndarray) -> tuple[float, int]:
        h, w = spectrum_norm.shape
        valid = np.zeros_like(mask, dtype=bool)
        valid[1 : h - 1, 1 : w - 1] = True

        is_peak = spectrum_norm > self.config.peak_threshold
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                neighbor = np.roll(spectrum_norm, shift=(dy, dx), axis=(0, 1))
                is_peak &= spectrum_norm > neighbor

        is_peak &= valid & mask
        peak_count = int(np.sum(is_peak))
        peak_density = peak_count / float(h * w)
        return peak_density, peak_count

    def _compute_score(self, metrics: Dict[str, float]) -> float:
        energy_score = min(
            1.0, metrics["high_freq_energy_ratio"] / self.config.high_freq_energy_threshold
        )
        peak_score = min(
            1.0, metrics["peak_density"] / self.config.peak_density_threshold
        )
        spike_score = min(1.0, metrics["spike_score"] / self.config.spike_threshold)

        weight_sum = self.config.weight_energy + self.config.weight_peaks + self.config.weight_spike
        return (
            energy_score * self.config.weight_energy
            + peak_score * self.config.weight_peaks
            + spike_score * self.config.weight_spike
        ) / weight_sum + 0.5
