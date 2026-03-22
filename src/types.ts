/* ── GENESIS-GPU-DOCKER-TEMPLATE — Types ─────────────────────────── */

/** GPU device information */
export interface GpuDevice {
  index: number;
  name: string;
  memoryTotalMb: number;
  memoryFreeMb: number;
  memoryUsedMb: number;
  utilizationPercent: number;
  temperatureCelsius: number;
  driverVersion: string;
  cudaVersion: string;
}

/** RAPIDS library availability */
export interface RapidsCapability {
  cudf: boolean;
  cuml: boolean;
  cugraph: boolean;
  cuopt: boolean;
}

/** NeMo library availability */
export interface NemoCapability {
  guardrails: boolean;
  tensorrt: boolean;
  triton: boolean;
}

/** Full capability probe result */
export interface GpuCapabilities {
  gpuAvailable: boolean;
  deviceCount: number;
  devices: GpuDevice[];
  rapids: RapidsCapability;
  nemo: NemoCapability;
  warp: boolean;
  morpheus: boolean;
  nvcomp: boolean;
  pythonVersion: string;
  nodeVersion: string;
  probedAt: string;
}

/** Worker mode — which tier this container is running */
export type WorkerMode = "rapids" | "nemo" | "full" | "cpu-fallback";

/** GPU worker state */
export interface GpuWorkerState {
  mode: WorkerMode;
  capabilities: GpuCapabilities;
  tasksProcessed: number;
  tasksQueued: number;
  tasksFailed: number;
  avgProcessingMs: number;
  lastTaskAt: string | null;
  registeredWithSpine: boolean;
  uptime: number;
}
