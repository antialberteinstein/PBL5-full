"""Camera client helpers for API."""

from __future__ import annotations

import logging
import threading
from typing import Optional

from camera.http_client import HTTPCamera
from camera.opencv_client import OpenCVCamera
from camera.udp_client import UDPCamera


_camera_lock = threading.Lock()
_camera_client: Optional[object] = None


def get_camera_client(camera_client: str) -> object:
    global _camera_client

    if _camera_client is None:
        client_key = camera_client.lower()
        if client_key == "udp":
            _camera_client = UDPCamera()
        elif client_key == "http":
            _camera_client = HTTPCamera()
        else:
            _camera_client = OpenCVCamera()
        logging.info("Camera client initialized: %s", _camera_client.__class__.__name__)

    return _camera_client


def get_camera_lock() -> threading.Lock:
    return _camera_lock
