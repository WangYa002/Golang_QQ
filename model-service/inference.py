"""Single-image adapter for the existing SCSegamba model code and checkpoints."""

import io
import os
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError


MODEL_IDS = ("Crack500", "CrackMap", "DeepCrack", "Facade390", "TUT")
INPUT_SIZE = (512, 512)
MAX_PIXELS = 8_000_000


def prepare_image(image_bytes: bytes) -> tuple[np.ndarray, tuple[int, int]]:
    """Return normalized NCHW RGB input and the oriented original size."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.format not in ("JPEG", "PNG"):
                raise ValueError("Only PNG and JPEG images are supported")
            if source.width * source.height > MAX_PIXELS:
                raise ValueError("Image dimensions are too large")
            rgb = ImageOps.exif_transpose(source).convert("RGB")
            original_size = rgb.size
            pixels = np.asarray(rgb)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Invalid image") from exc

    resized = cv2.resize(pixels, INPUT_SIZE, interpolation=cv2.INTER_CUBIC)
    tensor = (resized.astype(np.float32) / 127.5 - 1.0).transpose(2, 0, 1)[None]
    return np.ascontiguousarray(tensor), original_size


def probability_png(logits: np.ndarray, original_size: tuple[int, int]) -> bytes:
    """Convert model logits to a same-size 8-bit grayscale probability PNG."""
    logits = np.asarray(logits, dtype=np.float32)
    probabilities = 1.0 / (1.0 + np.exp(-np.clip(logits, -80, 80)))
    restored = cv2.resize(probabilities, original_size, interpolation=cv2.INTER_LINEAR)
    gray = np.rint(np.clip(restored, 0, 1) * 255).astype(np.uint8)
    ok, encoded = cv2.imencode(".png", gray)
    if not ok:
        raise RuntimeError("Could not encode prediction")
    return encoded.tobytes()


class ModelRunner:
    """Keep one checkpoint on the selected device at a time."""

    def __init__(self):
        self._lock = threading.Lock()
        self._model = None
        self._model_id = None
        self._device = None

    def _load(self, model_id: str):
        import torch

        source_dir = os.environ.get("SCSEGAMBA_CODE_DIR")
        weights_dir = os.environ.get("SCSEGAMBA_WEIGHTS_DIR")
        if not source_dir or not weights_dir:
            raise RuntimeError("SCSEGAMBA_CODE_DIR and SCSEGAMBA_WEIGHTS_DIR must be set")
        source = Path(source_dir).resolve()
        checkpoint_path = Path(weights_dir).resolve() / model_id / "checkpoint_best.pth"
        if not source.is_dir() or not checkpoint_path.is_file():
            raise RuntimeError(f"Model files missing for {model_id}")
        if str(source) not in sys.path:
            sys.path.insert(0, str(source))

        from models import build_model

        device = os.environ.get("MODEL_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
        args = SimpleNamespace(device=device, BCELoss_ratio=0.87, DiceLoss_ratio=0.13)
        model, _ = build_model(args)
        checkpoint = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(checkpoint["model"], strict=True)
        model.to(device).eval()
        self._model = model
        self._model_id = model_id
        self._device = device

    def predict(self, image_bytes: bytes, model_id: str) -> tuple[bytes, int, int, float]:
        if model_id not in MODEL_IDS:
            raise ValueError("Unknown model")
        image, (width, height) = prepare_image(image_bytes)
        with self._lock:
            start = time.perf_counter()
            if self._model_id != model_id:
                self._model = None
                self._model_id = None
                self._load(model_id)

            import torch

            with torch.inference_mode():
                output = self._model(torch.from_numpy(image).to(self._device))
            logits = output[0, 0].detach().float().cpu().numpy()
            elapsed_ms = (time.perf_counter() - start) * 1000
        return probability_png(logits, (width, height)), width, height, round(elapsed_ms, 1)


runner = ModelRunner()
