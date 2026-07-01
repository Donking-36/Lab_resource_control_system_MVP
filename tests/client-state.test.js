const assert = require("node:assert/strict");

const { state, updateState } = require("../src/client/state");

assert.deepEqual(state.gpuNodes, []);
assert.deepEqual(state.requests, []);
assert.deepEqual(state.sandboxes, []);
assert.deepEqual(state.rotations, []);
assert.deepEqual(state.evaluations, []);
assert.deepEqual(state.knowledge, []);
assert.deepEqual(state.gpuMonitor, { source: "loading" });

{
  const originalState = state;
  const originalRequests = state.requests;

  updateState({
    requests: [{ id: 1, student: "林可" }],
    gpuMonitor: { source: "nvidia-smi" },
  });

  assert.equal(state, originalState);
  assert.notEqual(state.requests, originalRequests);
  assert.deepEqual(state.requests, [{ id: 1, student: "林可" }]);
  assert.deepEqual(state.gpuMonitor, { source: "nvidia-smi" });
  assert.deepEqual(state.gpuNodes, []);
}

{
  updateState({ extraField: "保留服务端扩展字段" });
  assert.equal(state.extraField, "保留服务端扩展字段");
}

console.log("Client state tests passed");
