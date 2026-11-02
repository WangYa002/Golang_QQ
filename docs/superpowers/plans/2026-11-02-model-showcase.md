# Model Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal authenticated desktop page for single-image crack segmentation with five selectable checkpoints.

**Architecture:** React sends one image to Go, which validates and proxies to a Python process running the existing SCSegamba model. Python returns a grayscale probability image; React renders a thresholded overlay locally.

**Tech Stack:** React/TypeScript, Go/Gin, Python/PyTorch/FastAPI, existing Mamba model code.

**Spec:** `docs/superpowers/specs/2026-11-02-model-showcase-design.md`

## Global Constraints

- Do not commit model checkpoints or the external model source tree.
- Keep all model API routes behind the existing JWT middleware.
- Preserve current chat unread and call behavior when the new tab is selected.
- Input accepts PNG/JPEG, max 5 MiB, and one of five fixed model IDs.

---

### Task 1: Python inference adapter

**Files:** Create `model-service/app.py`, `model-service/inference.py`, `model-service/requirements.txt`, `model-service/test_inference.py`.

**Interfaces:** `predict(image_bytes: bytes, model_id: str) -> tuple[bytes, int, int, float]`; `POST /predict` returns `{mask, width, height, inference_ms}`.

- [ ] Write tests for image normalization, probability conversion and invalid payload using small tensors/images; run `python -m unittest model-service/test_inference.py` to see missing symbols fail.
- [ ] Implement lazy model loading, RGB 512×512 preprocessing and sigmoid mask conversion; run tests again.
- [ ] Implement FastAPI upload endpoint and error handling; run Python syntax and endpoint tests.

### Task 2: Go validation and proxy

**Files:** Create `server/handler/model.go`, `server/handler/model_test.go`; modify `server/router/router.go`.

**Interfaces:** `GET /api/model/weights` returns five IDs; `POST /api/model/predict` forwards multipart to `MODEL_BASE_URL/predict`.

- [ ] Write Gin handler tests for invalid model, invalid image, missing image, and successful upstream response; run `go test ./handler` to see missing handlers fail.
- [ ] Implement strict input validation, bounded upload and proxy timeout; register routes under `authorized`; run `go test ./...`.

### Task 3: Desktop showcase page

**Files:** Create `web/src/pages/ModelShowcase.tsx`, `web/src/pages/model-showcase.css`, `web/src/api/model.ts`; modify `web/src/pages/Chat.tsx`, `web/src/components/Sidebar.tsx`, `web/src/components/icons.tsx`.

**Interfaces:** Page accepts model choice and image, requests `/model/predict`, draws thresholded overlay, and downloads mask/overlay.

- [ ] Add a failing API/UI contract check for route names and response shape; run the check.
- [ ] Implement navigation, file input, loading/error states and result canvas; run `npm run build` and `npm run lint`.

### Task 4: Deployment documentation and delivery

**Files:** Create `model-service/README.md`; modify root `README.md` and `.gitignore` only if needed.

- [ ] Document environment variables, external source/weight mounts, and how to launch the three processes.
- [ ] Run tests/build, inspect diff for weight files or credentials, commit only feature files, then push `codex/model-showcase` to `origin`.
