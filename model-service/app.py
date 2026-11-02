"""Private HTTP endpoint for SCSegamba single-image inference."""

import base64

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from inference import MODEL_IDS, runner


app = FastAPI(title="SCSegamba inference", docs_url=None, redoc_url=None)
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/predict")
async def predict(model: str = Form(...), file: UploadFile = File(...)):
    if model not in MODEL_IDS:
        raise HTTPException(status_code=400, detail="Unknown model")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 1 byte to 5 MiB")
    try:
        png, width, height, elapsed_ms = runner.predict(data, model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Inference unavailable: {exc}") from exc
    return {
        "mask": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
        "width": width,
        "height": height,
        "inference_ms": elapsed_ms,
    }
