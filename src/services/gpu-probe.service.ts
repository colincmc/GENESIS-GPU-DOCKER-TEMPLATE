/* ── GENESIS-GPU-DOCKER-TEMPLATE — GPU Probe Service ─────────────── */
/* Probes GPU hardware + library availability at startup.             */
/* Reports capabilities to Spine Heartbeat for monitoring.            */

import { execSync } from "child_process";
import {
  GpuDevice,
  GpuCapabilities,
  RapidsCapability,
  NemoCapability,
  WorkerMode,
  GpuWorkerState,
} from "../types";

export class GpuProbeService {
  private capabilities: GpuCapabilities;
  private mode: WorkerMode;
  private tasksProcessed = 0;
  private tasksQueued = 0;
  private tasksFailed = 0;
  private processingTimes: number[] = [];
  private lastTaskAt: string | null = null;
  private registeredWithSpine = false;
  private startedAt = Date.now();

  constructor() {
    this.mode = (process.env.WORKER_MODE as WorkerMode) || "cpu-fallback";
    this.capabilities = this.probe();
  }

  /* ── Hardware Probe ────────────────────────────────────────────── */

  probe(): GpuCapabilities {
    const capabilities: GpuCapabilities = {
      gpuAvailable: false,
      deviceCount: 0,
      devices: [],
      rapids: { cudf: false, cuml: false, cugraph: false, cuopt: false },
      nemo: { guardrails: false, tensorrt: false, triton: false },
      warp: false,
      morpheus: false,
      nvcomp: false,
      pythonVersion: this.getPythonVersion(),
      nodeVersion: process.version,
      probedAt: new Date().toISOString(),
    };

    // Probe GPU hardware via nvidia-smi
    try {
      const smiOutput = execSync(
        "nvidia-smi --query-gpu=index,name,memory.total,memory.free,memory.used,utilization.gpu,temperature.gpu,driver_version --format=csv,noheader,nounits",
        { timeout: 5000, encoding: "utf-8" }
      );

      const lines = smiOutput.trim().split("\n").filter(l => l.trim());
      for (const line of lines) {
        const parts = line.split(",").map(s => s.trim());
        if (parts.length >= 8) {
          const device: GpuDevice = {
            index: parseInt(parts[0]) || 0,
            name: parts[1] || "Unknown",
            memoryTotalMb: parseInt(parts[2]) || 0,
            memoryFreeMb: parseInt(parts[3]) || 0,
            memoryUsedMb: parseInt(parts[4]) || 0,
            utilizationPercent: parseInt(parts[5]) || 0,
            temperatureCelsius: parseInt(parts[6]) || 0,
            driverVersion: parts[7] || "unknown",
            cudaVersion: this.getCudaVersion(),
          };
          capabilities.devices.push(device);
        }
      }

      capabilities.gpuAvailable = capabilities.devices.length > 0;
      capabilities.deviceCount = capabilities.devices.length;
    } catch {
      console.log("[GPU-PROBE] nvidia-smi not available — running in CPU fallback mode");
      this.mode = "cpu-fallback";
    }

    // Probe Python libraries
    capabilities.rapids = this.probeRapids();
    capabilities.nemo = this.probeNemo();
    capabilities.warp = this.probeLibrary("warp");
    capabilities.morpheus = this.probeLibrary("morpheus");
    capabilities.nvcomp = this.probeLibrary("pynvcomp");

    this.logCapabilities(capabilities);
    return capabilities;
  }

  /* ── Library Probes ────────────────────────────────────────────── */

  private probeRapids(): RapidsCapability {
    return {
      cudf: this.probeLibrary("cudf"),
      cuml: this.probeLibrary("cuml"),
      cugraph: this.probeLibrary("cugraph"),
      cuopt: this.probeLibrary("cuopt"),
    };
  }

  private probeNemo(): NemoCapability {
    return {
      guardrails: this.probeLibrary("nemoguardrails"),
      tensorrt: this.probeLibrary("tensorrt"),
      triton: this.probeLibrary("tritonclient"),
    };
  }

  private probeLibrary(name: string): boolean {
    try {
      execSync(`python3 -c "import ${name}"`, { timeout: 10000, encoding: "utf-8", stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  private getPythonVersion(): string {
    try {
      return execSync("python3 --version", { timeout: 3000, encoding: "utf-8" }).trim();
    } catch {
      return "not installed";
    }
  }

  private getCudaVersion(): string {
    try {
      const output = execSync("nvcc --version", { timeout: 3000, encoding: "utf-8" });
      const match = output.match(/release (\d+\.\d+)/);
      return match ? match[1] : "unknown";
    } catch {
      return "unknown";
    }
  }

  /* ── Spine Heartbeat Registration ──────────────────────────────── */

  async registerWithSpine(): Promise<boolean> {
    const spineUrl = process.env.SPINE_HEARTBEAT_URL;
    if (!spineUrl) {
      console.log("[GPU-PROBE] SPINE_HEARTBEAT_URL not set — skipping registration");
      return false;
    }

    const port = process.env.PORT || "8787";
    const serviceName = `gpu-${this.mode}-worker`;
    const healthUrl = `http://genesis-gpu-${this.mode}-worker:${port}/health`;

    try {
      const endpoint = this.capabilities.gpuAvailable ? "/services/gpu" : "/services/fallback";
      const res = await fetch(`${spineUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: serviceName, url: healthUrl }),
      });

      if (res.ok) {
        this.registeredWithSpine = true;
        console.log(`[GPU-PROBE] Registered with Spine Heartbeat as ${serviceName}`);
        return true;
      }
    } catch {
      console.warn("[GPU-PROBE] Failed to register with Spine Heartbeat — will retry");
    }

    return false;
  }

  /* ── Task Tracking ─────────────────────────────────────────────── */

  recordTaskStart(): void {
    this.tasksQueued++;
  }

  recordTaskComplete(processingMs: number): void {
    this.tasksQueued = Math.max(0, this.tasksQueued - 1);
    this.tasksProcessed++;
    this.lastTaskAt = new Date().toISOString();
    this.processingTimes.push(processingMs);
    if (this.processingTimes.length > 100) this.processingTimes.shift();
  }

  recordTaskFailed(): void {
    this.tasksQueued = Math.max(0, this.tasksQueued - 1);
    this.tasksFailed++;
    this.lastTaskAt = new Date().toISOString();
  }

  /* ── State ─────────────────────────────────────────────────────── */

  getCapabilities(): GpuCapabilities {
    return this.capabilities;
  }

  getState(): GpuWorkerState {
    const avgMs = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    return {
      mode: this.mode,
      capabilities: this.capabilities,
      tasksProcessed: this.tasksProcessed,
      tasksQueued: this.tasksQueued,
      tasksFailed: this.tasksFailed,
      avgProcessingMs: parseFloat(avgMs.toFixed(1)),
      lastTaskAt: this.lastTaskAt,
      registeredWithSpine: this.registeredWithSpine,
      uptime: Date.now() - this.startedAt,
    };
  }

  getMode(): WorkerMode {
    return this.mode;
  }

  isGpuAvailable(): boolean {
    return this.capabilities.gpuAvailable;
  }

  /* ── Logging ───────────────────────────────────────────────────── */

  private logCapabilities(cap: GpuCapabilities): void {
    console.log("[GPU-PROBE] ═══════════════════════════════════════");
    console.log(`[GPU-PROBE] Mode: ${this.mode}`);
    console.log(`[GPU-PROBE] GPU available: ${cap.gpuAvailable}`);
    if (cap.gpuAvailable) {
      for (const d of cap.devices) {
        console.log(`[GPU-PROBE]   Device ${d.index}: ${d.name} (${d.memoryTotalMb}MB, CUDA ${d.cudaVersion})`);
      }
    }
    console.log(`[GPU-PROBE] RAPIDS: cuDF=${cap.rapids.cudf} cuML=${cap.rapids.cuml} cuGraph=${cap.rapids.cugraph} cuOpt=${cap.rapids.cuopt}`);
    console.log(`[GPU-PROBE] NeMo: Guardrails=${cap.nemo.guardrails} TensorRT=${cap.nemo.tensorrt} Triton=${cap.nemo.triton}`);
    console.log(`[GPU-PROBE] Warp=${cap.warp} Morpheus=${cap.morpheus} NVComp=${cap.nvcomp}`);
    console.log(`[GPU-PROBE] Python: ${cap.pythonVersion} | Node: ${cap.nodeVersion}`);
    console.log("[GPU-PROBE] ═══════════════════════════════════════");
  }
}
