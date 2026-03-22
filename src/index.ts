/* ── GENESIS-GPU-DOCKER-TEMPLATE — Express Server ────────────────── */
/* GPU worker service — probes hardware, reports capabilities,        */
/* accepts compute tasks from Brighton GPU Interface.                  */
/* Runs inside GPU container or CPU fallback container.                */

import express from "express";
import { GpuProbeService } from "./services/gpu-probe.service";

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = parseInt(process.env.PORT || "8787", 10);
const probe = new GpuProbeService();

/* ── Health & State ──────────────────────────────────────────────── */

app.get("/health", (_req, res) => {
  const state = probe.getState();
  res.json({
    service: "genesis-gpu-worker",
    status: "UP",
    mode: state.mode,
    gpuAvailable: state.capabilities.gpuAvailable,
    deviceCount: state.capabilities.deviceCount,
    tasksProcessed: state.tasksProcessed,
    uptime: state.uptime,
  });
});

app.get("/state", (_req, res) => {
  res.json(probe.getState());
});

app.get("/capabilities", (_req, res) => {
  res.json(probe.getCapabilities());
});

app.post("/probe", (_req, res) => {
  const capabilities = probe.probe();
  res.json(capabilities);
});

/* ── Compute Endpoint ────────────────────────────────────────────── */
/* Brighton GPU Interface dispatches tasks here.                       */
/* In this template, returns a placeholder. Real GPU compute logic     */
/* will be added per-task when GPU services are built.                 */

app.post("/compute", (req, res) => {
  const { requestId, taskType, data, parameters } = req.body;
  if (!requestId || !taskType) {
    return res.status(400).json({ error: "requestId and taskType required" });
  }

  probe.recordTaskStart();
  const start = Date.now();

  if (!probe.isGpuAvailable()) {
    probe.recordTaskFailed();
    return res.json({
      requestId,
      taskType,
      status: "FAILED",
      processingTimeMs: Date.now() - start,
      completedAt: new Date().toISOString(),
      result: {
        type: taskType,
        error: "GPU not available — CPU fallback mode",
        fallback: true,
      },
    });
  }

  // Placeholder — real GPU compute dispatches to Python via child_process
  // Each task type will have its own Python script in /app/gpu-scripts/
  const elapsed = Date.now() - start;
  probe.recordTaskComplete(elapsed);

  res.json({
    requestId,
    taskType,
    status: "COMPLETED",
    processingTimeMs: elapsed,
    completedAt: new Date().toISOString(),
    result: {
      type: taskType,
      message: `GPU compute placeholder — ${taskType} received with ${data?.rowCount || data?.edgeCount || 0} rows`,
      gpuMode: probe.getMode(),
      capabilities: {
        rapids: probe.getCapabilities().rapids,
        nemo: probe.getCapabilities().nemo,
      },
    },
  });
});

/* ── Start ───────────────────────────────────────────────────────── */

// Register with Spine Heartbeat after startup
setTimeout(() => probe.registerWithSpine(), 5000);

app.listen(PORT, () => {
  console.log(`[GPU-WORKER] Listening on port ${PORT}`);
  console.log(`[GPU-WORKER] Mode: ${probe.getMode()}`);
  console.log(`[GPU-WORKER] GPU available: ${probe.isGpuAvailable()}`);
});
