"""FastAPI app exposing register, update, and verify endpoints.

When an endpoint is called, it submits a UI task to the main-thread
UI runner so the OpenCV window is displayed. The API thread blocks
until the UI window is closed (user presses 'q'/ESC or the flow
completes).
"""

from __future__ import annotations

import logging
import os
import sys
import threading
from contextlib import asynccontextmanager

if __package__ is None:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    src_dir = os.path.abspath(os.path.join(current_dir, ".."))
    if src_dir not in sys.path:
        sys.path.insert(0, src_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.api_config import CAMERA_CLIENT
from api.bridges.camera.camera_bridge import get_camera_client
from api.bridges.service.pipeline_bridge import (
    get_registration_pipelines,
    get_verification_pipelines,
)
from api.routes.local import register as register_routes
from api.routes.local import update as update_routes
from api.routes.local import verify as verify_routes
from api.routes.local import verify_stream as verify_stream_local_routes
from api.routes.stream import register_stream as register_stream_routes
from api.routes.stream import update_stream as update_stream_routes
from api.routes.stream import verify_stream as verify_stream_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up pipelines on startup to reduce first-request latency.
    get_registration_pipelines()
    get_verification_pipelines()
    get_camera_client(CAMERA_CLIENT)
    yield


app = FastAPI(title="Face Recognition API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(register_routes.router)
app.include_router(update_routes.router)
app.include_router(verify_routes.router)
app.include_router(verify_stream_local_routes.router)
app.include_router(register_stream_routes.router)
app.include_router(update_stream_routes.router)
app.include_router(verify_stream_routes.router)


def start_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    """Start uvicorn in a **daemon thread** so the main thread stays
    free for the OpenCV UI runner."""
    import uvicorn

    server_thread = threading.Thread(
        target=uvicorn.run,
        args=("api.app:app",),
        kwargs={"host": host, "port": port, "log_level": "info"},
        daemon=True,
    )
    server_thread.start()
    logging.info("Uvicorn started on http://%s:%d (daemon thread)", host, port)


if __name__ == "__main__":
    from api.api_config import CAMERA_CLIENT
    from api.bridges.camera.camera_bridge import get_camera_client
    from api.bridges.service.pipeline_bridge import (
        get_registration_pipelines,
        get_verification_pipelines,
    )
    from api.bridges.ui.ui_runner import run_ui_loop

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    ### 1. Initialize shared resources
    reg_recog_pipeline, classify_pipeline = get_registration_pipelines()
    ver_recog_pipeline, _ = get_verification_pipelines()
    camera = get_camera_client(CAMERA_CLIENT)

    ### 2. Start Uvicorn API server in background thread
    start_server()

    ### 3. Run OpenCV UI event loop on main thread (blocks forever)
    run_ui_loop(reg_recog_pipeline, ver_recog_pipeline, classify_pipeline, camera)
