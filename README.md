# GENESIS-GPU-DOCKER-TEMPLATE

**4-tier GPU Docker hierarchy — base CUDA through full NVIDIA stack with CPU fallback**

**Port:** `8787`

> **NVIDIA Phase 2A** — This service is a GPU-readiness pipe. It defines schemas, formats, and CPU-side logic that will activate when NVIDIA RAPIDS / NeMo / Warp hardware arrives. Phase 0 runs pure TypeScript on CPU.

---

## What It Does

1. Provides a 4-tier GPU Docker image hierarchy: base (CUDA 12.4 + Node 20 + Python 3.11), rapids (+ cuML/cuGraph/cuDF), nemo (+ NeMo Guardrails/TensorRT/Triton), full (+ Warp/Morpheus/cuOpt/NVComp)
2. Probes the host for GPU capabilities via nvidia-smi and Python library import testing
3. Reports detected GPU devices (name, VRAM, CUDA version, compute capability, temperature, utilisation)
4. Tests availability of 10 Python GPU libraries: cudf, cuml, cugraph, cuopt, nemoguardrails, tensorrt, tritonclient, warp, morpheus, pynvcomp
5. Registers with Spine Heartbeat Monitor on startup for health tracking
6. Operates in 4 worker modes: rapids, nemo, full, cpu-fallback — auto-detected from available libraries
7. Includes a GPU verification script for deployment validation

---

## Architecture

| File | Purpose | Lines |
|------|---------|-------|
| `src/index.ts` | Express server — 5 endpoints for health, state, capabilities, probe, compute | 106 |
| `src/types.ts` | GpuDevice, RapidsCapability, NemoCapability, GpuCapabilities, WorkerMode, GpuWorkerState | 61 |
| `src/services/gpu-probe.service.ts` | nvidia-smi probe, Python library detection, Spine Heartbeat registration | 241 |
| `Dockerfile` | CPU fallback — node:20.20.0-slim, EXPOSE 8787 | 10 |
| `Dockerfile.gpu-base` | Tier 1 — nvidia/cuda:12.4.1-runtime-ubuntu22.04, Node 20, Python 3.11 | 19 |
| `Dockerfile.gpu-rapids` | Tier 2 — + cudf-cu12, cuml-cu12, cugraph-cu12, pyarrow | 12 |
| `Dockerfile.gpu-nemo` | Tier 3 — + nemoguardrails, tensorrt, tritonclient | 12 |
| `Dockerfile.gpu-full` | Tier 4 — nvidia/cuda:12.4.1-devel + nvidia-warp, morpheus-mlflow, cuopt, pynvcomp | 14 |
| `docker-compose.gpu.yml` | 3 GPU workers (rapids:8790, nemo:8791, full:8792) + gpu_network bridge | 47 |
| `scripts/verify-gpu.sh` | GPU, CUDA, Python, Node, RAPIDS, NeMo, Warp, Morpheus verification | 92 |
| `package.json` | Express dependency | 18 |

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health + worker mode |
| GET | `/state` | Full worker state (mode, GPU devices, capabilities, uptime) |
| GET | `/capabilities` | Detected GPU capabilities (devices, RAPIDS, NeMo, libraries) |
| POST | `/probe` | Force re-probe of GPU hardware and libraries |
| POST | `/compute` | Submit a compute task (dispatches to Python GPU worker) |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | HTTP listen port |
| `WORKER_MODE` | `cpu-fallback` | Worker mode: rapids, nemo, full, cpu-fallback |
| `SPINE_HEARTBEAT_URL` | `null` | Spine Heartbeat Monitor URL for registration |

---

## Integration

- **Reads from:** Host GPU hardware (nvidia-smi), Python GPU libraries (import testing)
- **Writes to:** Spine Heartbeat Monitor (service registration), console (probe results)
- **Consumed by:** All GPU-dependent services via docker-compose.gpu.yml (3 worker pools)
- **GPU future:** This IS the GPU activation layer — Dockerfiles are ready for deployment on GPU instances

---

## Current State

- **Phase 0 BUILT** — CPU fallback mode, fully operational
- 4-tier Dockerfile hierarchy ready for GPU instances
- nvidia-smi probe and Python library detection implemented
- Spine Heartbeat registration on startup
- docker-compose.gpu.yml defines 3 GPU worker pools (rapids:8790, nemo:8791, full:8792)
- verify-gpu.sh validates full stack post-deployment

---

## Future Editions

1. **Deploy on T4 spot instance** — activate Tier 2 (RAPIDS) for cuML anomaly detection and cuGraph exchange analysis (~$50/mo)
2. **Deploy on A10G spot instance** — activate Tier 3 (NeMo) for Guardrails and TensorRT inference (~$200/mo)
3. **Full stack deployment** — activate Tier 4 for Warp simulation, Morpheus streaming, cuOpt routing, NVComp compression
4. **Auto-scaling GPU workers** — spin up/down GPU containers based on Spine Heartbeat load metrics
5. **Multi-GPU orchestration** — distribute task types across specialised GPU worker pools

---

## Rail Deployment

| Rail | Status | Notes |
|------|--------|-------|
| Rail 1 | BUILT | CPU fallback, 4-tier Dockerfiles ready, GPU probe + verify scripts |
| Rail 3 | GPU activation | T4/A10G spot instances, RAPIDS + NeMo tiers live |
| Rail 5+ | Full NVIDIA stack | Full tier deployment, auto-scaling, multi-GPU orchestration |
