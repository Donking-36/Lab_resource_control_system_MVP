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
      return {
        id: `local-gpu-${index}`,
        name: `GPU-${index} ${nameRaw}`,
        gpu: `1 x ${nameRaw}`,
        totalGpu: 1,
        usedGpu: utilization > 5 || memoryUsedGb > 0 ? 1 : 0,
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
