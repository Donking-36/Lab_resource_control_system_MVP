const { execFileSync } = require("node:child_process");

function queryRealGpuNodes(root) {
  const output = execFileSync(
    "nvidia-smi",
    ["--query-gpu=index,name,utilization.gpu,memory.total,memory.used", "--format=csv,noheader,nounits"],
    { encoding: "utf8", timeout: 3000 },
  );

  return parseNvidiaSmiOutput(output, root);
}

function parseNvidiaSmiOutput(output, root) {
  return output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [indexRaw, nameRaw, utilRaw, memoryTotalRaw, memoryUsedRaw] = line.split(",").map((part) => part.trim());
      const index = Number(indexRaw);
      const utilization = Number(utilRaw) || 0;
      const memoryTotalGb = Math.max(1, Math.round((Number(memoryTotalRaw) || 0) / 1024));
      const memoryUsedGb = Math.max(0, Math.round((Number(memoryUsedRaw) || 0) / 1024));
      // 桌面合成器/浏览器常驻占用 1-3GB 显存并造成低利用率抖动（尤其 Windows 笔记本独显），
      // 不能把任何非零显存都判为“GPU 被占用”。只有持续计算（利用率 >= 30%）
      // 或大块显存分配（>= 总量 30%，训练任务的典型特征）才视为忙碌。
      const busy = utilization >= 30 || memoryUsedGb / memoryTotalGb >= 0.3;
      return {
        id: `local-gpu-${index}`,
        name: `GPU-${index} ${nameRaw}`,
        gpu: `1 x ${nameRaw}`,
        totalGpu: 1,
        usedGpu: busy ? 1 : 0,
        memoryTotal: memoryTotalGb,
        memoryUsed: memoryUsedGb,
        mount: root,
        ports: [8801 + index * 10, 8802 + index * 10, 8803 + index * 10, 8804 + index * 10],
        source: "nvidia-smi",
      };
    });
}

module.exports = {
  parseNvidiaSmiOutput,
  queryRealGpuNodes,
};
