from __future__ import annotations

import json
import os
from collections import Counter
from io import BytesIO
from typing import Any

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover - optional dependency path
    YOLO = None

app = FastAPI(title="Verytis Vision Service", version="0.1.0")
_model = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "verytis-vision-service",
        "yolo_available": YOLO is not None,
    }


@app.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    metadata: str | None = Form(default=None),
) -> dict[str, Any]:
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Unsupported image MIME type")

    payload = await image.read()
    if len(payload) > 5_000_000:
        raise HTTPException(status_code=413, detail="Image is too large")

    try:
        pil_image = Image.open(BytesIO(payload)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image") from exc

    if pil_image.width < 32 or pil_image.height < 32:
        raise HTTPException(status_code=400, detail="Image dimensions are too small")
    if pil_image.width > 5000 or pil_image.height > 5000:
        raise HTTPException(status_code=413, detail="Image dimensions are too large")

    meta = _parse_metadata(metadata)
    objects = _detect_objects(pil_image)
    counts = Counter(obj["label"] for obj in objects)
    vehicle_count = sum(counts[label] for label in ["car", "truck", "bus", "motorcycle"])
    person_count = counts["person"]
    barrier_count = sum(counts[label] for label in ["barrier", "traffic cone", "stop sign"])
    obstruction_score = max(
        [obj["confidence"] for obj in objects if obj["label"] in {"barrier", "traffic cone", "stop sign"}],
        default=0,
    )

    observed_state = "unknown"
    confidence = 0.35
    evidence: dict[str, Any] = {
        "vehicle_count": vehicle_count,
        "person_count": person_count,
        "barrier_count": barrier_count,
        "analyzer": "local_object_detector",
        "metadata": meta,
    }

    if barrier_count > 0:
        observed_state = "possibly_blocked"
        confidence = max(0.74, obstruction_score)
        evidence["barrier_detected"] = True
    elif vehicle_count >= 12:
        observed_state = "congested"
        confidence = 0.68
    elif vehicle_count >= 2:
        observed_state = "normal"
        confidence = 0.62
    elif vehicle_count == 0:
        observed_state = "low_flow"
        confidence = 0.52

    return {
        "objects": objects,
        "counts": dict(counts),
        "metrics": {
            "vehicle_count": vehicle_count,
            "person_count": person_count,
            "barrier_count": barrier_count,
            "obstruction_score": obstruction_score,
        },
        "interpretation": {
            "observed_state": observed_state,
            "confidence": round(confidence, 3),
            "evidence": evidence,
        },
    }


def _parse_metadata(metadata: str | None) -> dict[str, Any]:
    if not metadata:
        return {}
    try:
        parsed = json.loads(metadata)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _detect_objects(image: Image.Image) -> list[dict[str, Any]]:
    if YOLO is not None:
        try:
            return _detect_with_yolo(image)
        except Exception:
            pass
    return _fallback_detector(image)


def _detect_with_yolo(image: Image.Image) -> list[dict[str, Any]]:
    global _model
    if _model is None:
        model_name = os.environ.get("VISION_MODEL", "yolov8n.pt")
        _model = YOLO(model_name)

    results = _model.predict(np.array(image), verbose=False)
    names = results[0].names
    objects: list[dict[str, Any]] = []
    for box in results[0].boxes:
        cls = int(box.cls[0])
        xyxy = box.xyxy[0].tolist()
        objects.append(
            {
                "label": names.get(cls, str(cls)),
                "confidence": round(float(box.conf[0]), 3),
                "bbox": [round(float(value), 2) for value in xyxy],
            }
        )
    return objects


def _fallback_detector(image: Image.Image) -> list[dict[str, Any]]:
    arr = np.array(image)
    height, width, _ = arr.shape
    brightness = float(arr.mean())
    saturation = float(np.abs(arr[:, :, 0] - arr[:, :, 1]).mean())
    objects: list[dict[str, Any]] = []

    if brightness < 50:
        return objects

    if saturation > 28:
        objects.append(
            {
                "label": "car",
                "confidence": 0.55,
                "bbox": [width * 0.35, height * 0.45, width * 0.55, height * 0.62],
            }
        )

    if brightness > 190 and saturation > 45:
        objects.append(
            {
                "label": "barrier",
                "confidence": 0.58,
                "bbox": [width * 0.20, height * 0.60, width * 0.80, height * 0.70],
            }
        )

    return objects
