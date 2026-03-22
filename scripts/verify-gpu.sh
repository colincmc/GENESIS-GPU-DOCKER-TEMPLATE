#!/bin/bash
# ── GENESIS GPU VERIFICATION SCRIPT ─────────────────────────────────
# Run inside GPU container to verify all components are working.
# Usage: docker exec genesis-gpu-rapids-worker /app/scripts/verify-gpu.sh
# ─────────────────────────────────────────────────────────────────────

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  GENESIS GPU VERIFICATION"
echo "═══════════════════════════════════════════════════════════"

# ── Check nvidia-smi ──────────────────────────────────────────────
echo ""
echo "1. NVIDIA Driver & GPU"
echo "───────────────────────────────────────────────────────────"
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
    echo "✓ GPU detected"
else
    echo "✗ nvidia-smi not found — no GPU available"
fi

# ── Check CUDA ────────────────────────────────────────────────────
echo ""
echo "2. CUDA Toolkit"
echo "───────────────────────────────────────────────────────────"
if command -v nvcc &> /dev/null; then
    nvcc --version | grep "release"
    echo "✓ CUDA available"
else
    echo "  nvcc not found (runtime image — expected)"
    python3 -c "import torch; print(f'CUDA via PyTorch: {torch.cuda.is_available()}')" 2>/dev/null || echo "  CUDA runtime only"
fi

# ── Check Python ──────────────────────────────────────────────────
echo ""
echo "3. Python"
echo "───────────────────────────────────────────────────────────"
python3 --version

# ── Check Node.js ─────────────────────────────────────────────────
echo ""
echo "4. Node.js"
echo "───────────────────────────────────────────────────────────"
node --version

# ── Check RAPIDS ──────────────────────────────────────────────────
echo ""
echo "5. RAPIDS Libraries"
echo "───────────────────────────────────────────────────────────"
python3 -c "import cudf; print(f'  cuDF:    {cudf.__version__}')" 2>/dev/null || echo "  cuDF:    not installed"
python3 -c "import cuml; print(f'  cuML:    {cuml.__version__}')" 2>/dev/null || echo "  cuML:    not installed"
python3 -c "import cugraph; print(f'  cuGraph: {cugraph.__version__}')" 2>/dev/null || echo "  cuGraph: not installed"

# ── Check NeMo ────────────────────────────────────────────────────
echo ""
echo "6. NeMo Libraries"
echo "───────────────────────────────────────────────────────────"
python3 -c "import nemoguardrails; print(f'  Guardrails: {nemoguardrails.__version__}')" 2>/dev/null || echo "  Guardrails: not installed"
python3 -c "import tensorrt; print(f'  TensorRT:   {tensorrt.__version__}')" 2>/dev/null || echo "  TensorRT:   not installed"
python3 -c "import tritonclient; print(f'  Triton:     available')" 2>/dev/null || echo "  Triton:     not installed"

# ── Check Warp + Morpheus ─────────────────────────────────────────
echo ""
echo "7. Advanced Libraries"
echo "───────────────────────────────────────────────────────────"
python3 -c "import warp; print(f'  Warp:     {warp.__version__}')" 2>/dev/null || echo "  Warp:     not installed"
python3 -c "import morpheus; print(f'  Morpheus: available')" 2>/dev/null || echo "  Morpheus: not installed"

# ── Quick GPU memory test ─────────────────────────────────────────
echo ""
echo "8. GPU Memory Test"
echo "───────────────────────────────────────────────────────────"
python3 -c "
try:
    import cudf
    import cupy as cp
    arr = cp.ones(1_000_000, dtype=cp.float32)
    print(f'  Allocated 1M floats on GPU: {arr.sum():.0f} (expected 1000000)')
    print('  ✓ GPU memory working')
    del arr
    cp.get_default_memory_pool().free_all_blocks()
except Exception as e:
    print(f'  GPU memory test skipped: {e}')
" 2>/dev/null || echo "  GPU memory test skipped — RAPIDS not available"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  VERIFICATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
