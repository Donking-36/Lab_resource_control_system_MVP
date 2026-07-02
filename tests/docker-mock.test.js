const assert = require("node:assert/strict");

const { createDockerMockAdapter } = require("../src/server/adapters/dockerMock");
const { createDockerAdapter } = require("../src/server/adapters/docker");
const { HttpError } = require("../src/server/errors");

const mock = createDockerMockAdapter({ containerPort: 8888, imageTemplates: { "busybox-demo": "busybox:latest" } });
const real = createDockerAdapter({ containerPort: 8888, imageTemplates: {}, HttpError });

// Interface parity: everything the services/repositories call exists on both.
[
  "makeContainerName",
  "createDockerContainer",
  "inspectContainerStatus",
  "pauseContainer",
  "unpauseContainer",
  "removeContainer",
  "commitContainer",
  "getDockerHealth",
].forEach((method) => {
  assert.equal(typeof mock[method], "function", `mock.${method}`);
  assert.equal(typeof real[method], "function", `real.${method}`);
});

// Health advertises the mock mode instead of pretending to be a daemon.
const health = mock.getDockerHealth();
assert.equal(health.available, true);
assert.equal(health.mode, "mock");
assert.equal(mock.makeContainerName(7), "lab-rot-7");

// Full container lifecycle.
const created = mock.createDockerContainer({ request: { image: "busybox-demo", dataset: "/tmp" }, port: 8801, name: "lab-rot-7" });
assert.ok(created.containerId);
assert.equal(created.containerName, "lab-rot-7");
assert.equal(created.image, "busybox:latest");
assert.equal(created.containerPort, 8888);
assert.equal(mock.inspectContainerStatus(created.containerId), "running");

mock.pauseContainer({ container_id: created.containerId });
assert.equal(mock.inspectContainerStatus(created.containerId), "paused");
mock.unpauseContainer({ container_id: created.containerId });
assert.equal(mock.inspectContainerStatus(created.containerId), "running");

assert.equal(mock.commitContainer({ id: "lab-rot-7", container_id: created.containerId }, 2), "lab-snapshot:lab-rot-7-2");

mock.removeContainer({ container_id: created.containerId });
assert.equal(mock.inspectContainerStatus(created.containerId), "未知");
assert.equal(mock.inspectContainerStatus(""), "未创建");
assert.equal(mock.commitContainer({ id: "x", container_id: "" }, 1), "");

console.log("Docker mock tests passed");
