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
    utilization: 0,
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
    utilization: 23,
    memoryTotal: 24,
    memoryUsed: 8,
    mount: "/lab/root",
    ports: [8811, 8812, 8813, 8814],
    source: "nvidia-smi",
  },
]);

// 回归：Windows 桌面/浏览器底噪（低利用率 + 少量常驻显存）不得把空闲 GPU 判为占用。
{
  const [idleDesktop, computing] = parseNvidiaSmiOutput(
    [
      "0, NVIDIA GeForce RTX 5090 Laptop GPU, 4, 24576, 3072",
      "1, NVIDIA GeForce RTX 5090 Laptop GPU, 85, 24576, 2048",
    ].join("\n"),
    "/lab/root",
  );

  assert.equal(idleDesktop.usedGpu, 0, "3/24GB 桌面底噪应视为空闲");
  assert.equal(idleDesktop.memoryUsed, 3);
  assert.equal(idleDesktop.utilization, 4, "真实利用率原样透出");
  assert.equal(computing.usedGpu, 1, "高利用率应视为占用");
  assert.equal(computing.utilization, 85);
}

console.log("GPU monitor tests passed");
