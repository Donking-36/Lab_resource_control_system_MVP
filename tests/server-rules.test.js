const assert = require("node:assert/strict");

const { HttpError } = require("../src/server/errors");
const { assertNumber, assertText } = require("../src/server/http");
const { applyAllocationToNode, returnPortToNode, selectGpuNode } = require("../src/server/rules");

assert.equal(assertText("  陈曦  ", "学生"), "陈曦");
assert.throws(() => assertText("", "学生"), (error) => error instanceof HttpError && error.status === 400);

assert.equal(assertNumber("3.6", "GPU 数", 1, 8), 4);
assert.throws(() => assertNumber(9, "GPU 数", 1, 8), (error) => error instanceof HttpError && error.status === 400);

const selected = selectGpuNode(
  [
    { id: "full", totalGpu: 4, usedGpu: 4, ports: [8801] },
    { id: "busy", totalGpu: 4, usedGpu: 2, ports: [8802] },
    { id: "free", totalGpu: 4, usedGpu: 1, ports: [8803] },
  ],
  1,
);
assert.equal(selected.id, "free");
assert.equal(selectGpuNode([{ id: "none", totalGpu: 1, usedGpu: 0, ports: [] }], 1), undefined);

const allocated = applyAllocationToNode(
  { totalGpu: 4, usedGpu: 3, memoryTotal: 80, memoryUsed: 72 },
  { gpus: 2 },
  [8802, 8803],
  "now",
);
assert.deepEqual(allocated, {
  usedGpu: 4,
  memoryUsed: 80,
  portsJson: "[8802,8803]",
  updatedAt: "now",
});

const returned = returnPortToNode(
  { used_gpu: 2, memory_used: 36, ports_json: "[8810,8814]" },
  { gpus: 1, port: 8812 },
  "later",
);
assert.deepEqual(returned, {
  usedGpu: 1,
  memoryUsed: 18,
  portsJson: "[8810,8812,8814]",
  updatedAt: "later",
});

const returnedExistingPort = returnPortToNode(
  { used_gpu: 1, memory_used: 12, ports_json: "[8812,8814]" },
  { gpus: 3, port: 8812 },
  "done",
);
assert.deepEqual(returnedExistingPort, {
  usedGpu: 0,
  memoryUsed: 0,
  portsJson: "[8812,8814]",
  updatedAt: "done",
});

console.log("Server rule tests passed");
