const assert = require("node:assert/strict");

const { buildSchedulingSnapshot, jainFairness, rankGpuNodes, waitingMinutes } = require("../src/server/scheduler");

const now = new Date("2026-07-02T12:00:00+08:00");
assert.equal(waitingMinutes("10:00", now), 120);
assert.equal(waitingMinutes("13:00", now), 1380);
assert.equal(jainFairness([1, 1]), 1);
assert.equal(jainFairness([2, 0]), 0.5);

const nodes = [
  { id: "seed", name: "Seed", totalGpu: 4, usedGpu: 0, memoryTotal: 96, memoryUsed: 20, ports: [8801], source: "seed" },
  { id: "real", name: "Real", totalGpu: 4, usedGpu: 0, memoryTotal: 96, memoryUsed: 20, ports: [8811], source: "nvidia-smi" },
];
assert.equal(rankGpuNodes(nodes, { gpus: 1 })[0].node.id, "real");

const snapshot = buildSchedulingSnapshot({
  now,
  gpuNodes: nodes,
  sandboxes: [{ student: "甲", gpus: 2 }],
  requests: [
    { id: 1, student: "甲", status: "waiting", urgency: 3, credit: 90, gpus: 1, hours: 8, createdAt: "11:00" },
    { id: 2, student: "乙", status: "waiting", urgency: 5, credit: 90, gpus: 1, hours: 8, createdAt: "11:00" },
  ],
});

assert.equal(snapshot.algorithm, "xfs-v1");
assert.equal(snapshot.decisions[0].requestId, 2);
assert.equal(snapshot.decisions[0].recommendedNode.id, "real");
assert.ok(snapshot.decisions[0].components.fairness > snapshot.decisions[1].components.fairness);
assert.ok(snapshot.fairnessIndex > 0 && snapshot.fairnessIndex < 1);

console.log("Scheduler tests passed");
