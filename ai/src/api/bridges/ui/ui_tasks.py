"""UI task definitions used by API endpoints."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, Optional


class UITaskType(Enum):
    REGISTER = auto()
    UPDATE = auto()
    VERIFY = auto()


@dataclass
class UITask:
    """A unit of work submitted by an API endpoint."""

    task_type: UITaskType
    params: Dict[str, Any] = field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    done_event: threading.Event = field(default_factory=threading.Event)
