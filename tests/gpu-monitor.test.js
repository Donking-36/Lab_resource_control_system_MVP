const assert = require("node:assert/strict");

const { parseNvidiaSmiOutput } = require("../src/server/adapters/gpuMonitor");

const nodes = parseNvidiaSmiOutput(
  [
    "0, NVIDIA A100-SXM4-80GB, 0, 81920, 0",
    "1, NVIDIA GeForce RTX 4090, 23, 24564, 8192",
  ].join("\n"),
  "/lab/root",
);

assert.deepEqual(nodes, [
  {
    id: "local-gpu-0",
    name: "GPU-0 NVIDIA A100-SXM4-80GB",
    gpu: "1 x NVIDIA A100-SXM4-80GB",
    totalGpu: 1,
    usedGpu: 0,
    memoryTotal: 80,
    memoryUsed: 0,
    mount: "/lab/root",
    ports: [8801, 8802, 8803, 8804],
    source: "nvidia-smi",
  },
  {
    id: "local-gpu-1",
    name: "GPU-1 NVIDIA GeForce RTX 4090",
    gpu: "1 x NVIDIA GeForce RTX 4090",
    totalGpu: 1,
    usedGpu: 1,
    memoryTotal: 24,
    memoryUsed: 8,
    mount: "/lab/root",
    ports: [8811, 8812, 8813, 8814],
    source: "nvidia-smi",
  },
]);

console.log("GPU monitor tests passed");
