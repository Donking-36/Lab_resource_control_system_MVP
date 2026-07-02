const assert = require("node:assert/strict");

const { HttpError } = require("../src/server/errors");
const { assertNumber, assertText } = require("../src/server/http");
const { applyAllocationToNode, returnPortToNode, selectGpuNode } = require("../src/server/rules");
const { createEvaluationService } = require("../src/server/services/evaluations");
const { createRequestService } = require("../src/server/services/requests");
const { createRotationService } = require("../src/server/services/rotations");
const { createSandboxService } = require("../src/server/services/sandboxes");
const { createStateService } = require("../src/server/services/state");

function names(calls) {
  return calls.map((call) => call.name);
}

function createDocker(calls, overrides = {}) {
  return {
    makeContainerName(id) {
      calls.push({ name: "makeContainerName", id });
      return `lab-rot-${id}`;
    },
    createDockerContainer(payload) {
      calls.push({ name: "createDockerContainer", payload });
      if (overrides.createDockerContainer) return overrides.createDockerContainer(payload);
      return {
        containerId: "container-7",
        containerName: payload.name,
        containerPort: 8888,
        image: "busybox:latest",
        mountPath: payload.request.dataset,
      };
    },
    removeContainer(box) {
      calls.push({ name: "removeContainer", box });
      if (overrides.removeContainer) return overrides.removeContainer(box);
      return undefined;
    },
    pauseContainer(box) {
      calls.push({ name: "pauseContainer", box });
      if (overrides.pauseContainer) return overrides.pauseContainer(box);
      return undefined;
    },
    unpauseContainer(box) {
      calls.push({ name: "unpauseContainer", box });
      if (overrides.unpauseContainer) return overrides.unpauseContainer(box);
      return undefined;
    },
    commitContainer(box, nextVersion) {
      calls.push({ name: "commitContainer", box, nextVersion });
      if (overrides.commitContainer) return overrides.commitContainer(box, nextVersion);
      return `lab-snapshot:${box.id}-${nextVersion}`;
    },
  };
}

function createRequestHarness(overrides = {}) {
  const calls = [];
  const request = {
    id: 7,
    student: "林可",
    topic: "小模型微调",
    gpus: 1,
    hours: 8,
    urgency: 3,
    image: "busybox-demo",
    dataset: "/tmp/lab-dataset",
    credit: 90,
    status: "waiting",
  };
  const repositories = {
    insertRequest(payload) {
      calls.push({ name: "insertRequest", payload });
    },
    getRequestById(id) {
      calls.push({ name: "getRequestById", id });
      return overrides.request === undefined ? request : overrides.request;
    },
    begin() {
      calls.push({ name: "begin" });
      if (overrides.begin) return overrides.begin();
      return undefined;
    },
    commit() {
      calls.push({ name: "commit" });
    },
    rollback() {
      calls.push({ name: "rollback" });
    },
    updateNodeAllocation(nodeId, allocation) {
      calls.push({ name: "updateNodeAllocation", nodeId, allocation });
      if (overrides.updateNodeAllocation) return overrides.updateNodeAllocation(nodeId, allocation);
      return undefined;
    },
    markRequestAllocated(id) {
      calls.push({ name: "markRequestAllocated", id });
    },
    insertSandboxFromAllocation(payload) {
      calls.push({ name: "insertSandboxFromAllocation", payload });
    },
    rejectWaitingRequest(id) {
      calls.push({ name: "rejectWaitingRequest", id });
      return overrides.rejectChanges === undefined ? 1 : overrides.rejectChanges;
    },
  };
  const docker = createDocker(calls, overrides.docker);
  const service = createRequestService({
    repositories,
    docker,
    getGpuNodes() {
      calls.push({ name: "getGpuNodes" });
      return {
        nodes: [
          {
            id: "node-a",
            totalGpu: 4,
            usedGpu: 1,
            memoryTotal: 80,
            memoryUsed: 18,
            ports: [8801, 8802],
          },
        ],
      };
    },
    assertNumber,
    assertText,
    HttpError,
    applyAllocationToNode,
    selectGpuNode,
    nowText: () => "12:00",
  });
  return { calls, service };
}

{
  const { calls, service } = createRequestHarness();
  service.createRequest({
    student: "  林可  ",
    topic: " 小模型微调 ",
    gpus: "1.2",
    hours: "4.6",
    urgency: "3.1",
    image: " busybox-demo ",
    dataset: " /tmp/lab-dataset ",
  });

  assert.equal(calls[0].payload.student, "林可");
  assert.equal(calls[0].payload.topic, "小模型微调");
  assert.equal(calls[0].payload.gpus, 1);
  assert.equal(calls[0].payload.hours, 5);
  assert.equal(calls[0].payload.urgency, 3);
  assert.equal(calls[0].payload.image, "busybox-demo");
  assert.equal(calls[0].payload.dataset, "/tmp/lab-dataset");
  assert.ok(calls[0].payload.credit >= 80 && calls[0].payload.credit <= 97);
}

{
  const { calls, service } = createRequestHarness();
  service.approveRequest(7);

  assert.deepEqual(names(calls), [
    "getRequestById",
    "getGpuNodes",
    "makeContainerName",
    "createDockerContainer",
    "begin",
    "updateNodeAllocation",
    "markRequestAllocated",
    "insertSandboxFromAllocation",
    "commit",
  ]);
  assert.deepEqual(calls.find((call) => call.name === "updateNodeAllocation"), {
    name: "updateNodeAllocation",
    nodeId: "node-a",
    allocation: {
      usedGpu: 2,
      memoryUsed: 36,
      portsJson: "[8802]",
      updatedAt: "12:00",
    },
  });
  assert.equal(calls.find((call) => call.name === "insertSandboxFromAllocation").payload.id, "lab-rot-7");
}

{
  const { calls, service } = createRequestHarness({
    begin() {
      throw new Error("begin failed");
    },
  });

  assert.throws(() => service.approveRequest(7), /begin failed/);
  assert.deepEqual(names(calls), [
    "getRequestById",
    "getGpuNodes",
    "makeContainerName",
    "createDockerContainer",
    "begin",
    "removeContainer",
  ]);
}

{
  const { calls, service } = createRequestHarness({
    updateNodeAllocation() {
      throw new Error("database failed");
    },
  });

  assert.throws(() => service.approveRequest(7), /database failed/);
  assert.deepEqual(names(calls), [
    "getRequestById",
    "getGpuNodes",
    "makeContainerName",
    "createDockerContainer",
    "begin",
    "updateNodeAllocation",
    "rollback",
    "removeContainer",
  ]);
  assert.deepEqual(calls.at(-1).box, { container_id: "container-7" });
}

{
  const { service } = createRequestHarness({ request: null });
  assert.throws(() => service.approveRequest(7), (error) => error instanceof HttpError && error.status === 404);
}

{
  const { service } = createRequestHarness({ rejectChanges: 0 });
  assert.throws(() => service.rejectRequest(7), (error) => error instanceof HttpError && error.status === 404);
}

function createSandboxHarness(overrides = {}) {
  const calls = [];
  const box = {
    id: "lab-rot-7",
    node_id: "node-a",
    gpus: 1,
    port: 8801,
    status: "running",
    snapshots: 1,
    container_id: "container-7",
    snapshot_image: "",
  };
  const node = {
    id: "node-a",
    used_gpu: 2,
    memory_used: 36,
    ports_json: "[8802]",
  };
  const repositories = {
    getSandboxById(id) {
      calls.push({ name: "getSandboxById", id });
      return overrides.box === undefined ? box : overrides.box;
    },
    getGpuNodeRowById(id) {
      calls.push({ name: "getGpuNodeRowById", id });
      return overrides.node === undefined ? node : overrides.node;
    },
    begin() {
      calls.push({ name: "begin" });
      if (overrides.begin) return overrides.begin();
      return undefined;
    },
    commit() {
      calls.push({ name: "commit" });
    },
    rollback() {
      calls.push({ name: "rollback" });
    },
    updateNodeAllocation(nodeId, allocation) {
      calls.push({ name: "updateNodeAllocation", nodeId, allocation });
      if (overrides.updateNodeAllocation) return overrides.updateNodeAllocation(nodeId, allocation);
      return undefined;
    },
    deleteSandbox(id) {
      calls.push({ name: "deleteSandbox", id });
    },
    updateSandboxError(id, message) {
      calls.push({ name: "updateSandboxError", id, message });
    },
    updateSandboxStatus(id, status) {
      calls.push({ name: "updateSandboxStatus", id, status });
    },
    updateSandboxSnapshot(id, snapshots, snapshotImage) {
      calls.push({ name: "updateSandboxSnapshot", id, snapshots, snapshotImage });
    },
  };
  const docker = createDocker(calls, overrides.docker);
  const service = createSandboxService({
    repositories,
    docker,
    HttpError,
    returnPortToNode,
    nowText: () => "12:30",
  });
  return { calls, service };
}

{
  const { calls, service } = createSandboxHarness();
  service.releaseSandbox("lab-rot-7");

  assert.deepEqual(names(calls), [
    "getSandboxById",
    "getGpuNodeRowById",
    "begin",
    "removeContainer",
    "updateNodeAllocation",
    "deleteSandbox",
    "commit",
  ]);
  assert.deepEqual(calls.find((call) => call.name === "updateNodeAllocation").allocation, {
    usedGpu: 1,
    memoryUsed: 18,
    portsJson: "[8801,8802]",
    updatedAt: "12:30",
  });
}

{
  const { calls, service } = createSandboxHarness({
    docker: {
      removeContainer() {
        throw new Error("docker failed");
      },
    },
  });

  assert.throws(() => service.releaseSandbox("lab-rot-7"), /docker failed/);
  assert.deepEqual(names(calls), [
    "getSandboxById",
    "getGpuNodeRowById",
    "begin",
    "removeContainer",
    "rollback",
    "updateSandboxError",
  ]);
  assert.equal(calls.at(-1).message, "docker failed");
}

{
  const { calls, service } = createSandboxHarness({
    begin() {
      throw new Error("begin failed");
    },
  });

  assert.throws(() => service.releaseSandbox("lab-rot-7"), /begin failed/);
  assert.deepEqual(names(calls), ["getSandboxById", "getGpuNodeRowById", "begin"]);
}

{
  const { calls, service } = createSandboxHarness({
    updateNodeAllocation() {
      throw new Error("database failed");
    },
  });

  assert.throws(() => service.releaseSandbox("lab-rot-7"), /database failed/);
  assert.deepEqual(names(calls), [
    "getSandboxById",
    "getGpuNodeRowById",
    "begin",
    "removeContainer",
    "updateNodeAllocation",
    "rollback",
    "updateSandboxError",
  ]);
  assert.equal(calls.at(-1).message, "database failed");
}

{
  const { calls, service } = createSandboxHarness();
  service.toggleSandbox("lab-rot-7");
  assert.deepEqual(names(calls), ["getSandboxById", "pauseContainer", "updateSandboxStatus"]);
  assert.equal(calls.at(-1).status, "paused");
}

{
  const { calls, service } = createSandboxHarness();
  service.snapshotSandbox("lab-rot-7");
  assert.deepEqual(names(calls), ["getSandboxById", "commitContainer", "updateSandboxSnapshot"]);
  assert.deepEqual(calls.at(-1), {
    name: "updateSandboxSnapshot",
    id: "lab-rot-7",
    snapshots: 2,
    snapshotImage: "lab-snapshot:lab-rot-7-2",
  });
}

{
  const calls = [];
  const repositories = {
    getRotationById(id) {
      calls.push({ name: "getRotationById", id });
      return { id };
    },
    getNextIncompleteStage(id) {
      calls.push({ name: "getNextIncompleteStage", id });
      return { id: 31, progress: 92 };
    },
    updateStageProgress(stageId, progress) {
      calls.push({ name: "updateStageProgress", stageId, progress });
    },
    resetRotationUpdateDays(id) {
      calls.push({ name: "resetRotationUpdateDays", id });
    },
    reduceRotationUpdateDays(id) {
      calls.push({ name: "reduceRotationUpdateDays", id });
      return 1;
    },
  };
  const service = createRotationService({ repositories, HttpError });
  service.progressRotation(3);
  service.remindRotation(3);

  assert.deepEqual(names(calls), [
    "getRotationById",
    "getNextIncompleteStage",
    "updateStageProgress",
    "resetRotationUpdateDays",
    "reduceRotationUpdateDays",
  ]);
  assert.equal(calls.find((call) => call.name === "updateStageProgress").progress, 100);
}

{
  const service = createRotationService({
    repositories: {
      getRotationById: () => ({ id: 3 }),
      getNextIncompleteStage: () => null,
    },
    HttpError,
  });

  assert.throws(() => service.progressRotation(3), (error) => error instanceof HttpError && error.status === 409);
}

{
  const calls = [];
  const service = createEvaluationService({
    repositories: {
      upsertEvaluation(evaluation) {
        calls.push({ name: "upsertEvaluation", evaluation });
      },
    },
    assertNumber,
    assertText,
  });

  service.saveEvaluation({
    student: " 林可 ",
    score: "88.4",
    code: "90",
    efficiency: "85",
    delivery: "89",
  });
  assert.deepEqual(calls[0].evaluation, {
    student: "林可",
    score: 88,
    code: 90,
    efficiency: 85,
    delivery: 89,
  });
  assert.throws(() => service.saveEvaluation({ student: "林可", score: 101, code: 90, efficiency: 85, delivery: 89 }));
}

{
  const calls = [];
  const node = { id: "local-gpu-0" };
  const service = createStateService({
    root: "/lab",
    repositories: {
      upsertRealGpuNode(gpuNode, nowText) {
        calls.push({ name: "upsertRealGpuNode", gpuNode, nowText });
      },
      getGpuNodesBySource() {
        calls.push({ name: "getGpuNodesBySource" });
        return [node];
      },
    },
    queryRealGpuNodes(root) {
      calls.push({ name: "queryRealGpuNodes", root });
      return [node];
    },
    nowText: () => "13:00",
  });

  assert.deepEqual(service.getGpuNodes(), {
    nodes: [node],
    monitor: { source: "nvidia-smi", updatedAt: "13:00" },
  });
  assert.deepEqual(names(calls), ["queryRealGpuNodes", "upsertRealGpuNode", "getGpuNodesBySource"]);
}

// 真实节点的瞬时利用率应叠加到数据库行上返回给前端。
{
  const dbRow = { id: "local-gpu-0", totalGpu: 1, usedGpu: 0 };
  const service = createStateService({
    root: "/lab",
    repositories: {
      upsertRealGpuNode() {},
      getGpuNodesBySource: () => [dbRow],
    },
    queryRealGpuNodes: () => [{ id: "local-gpu-0", utilization: 37 }],
    nowText: () => "13:10",
  });

  const { nodes } = service.getGpuNodes();
  assert.equal(nodes[0].utilization, 37);
  assert.equal(nodes[0].usedGpu, 0);
  assert.ok(!("utilization" in dbRow), "数据库行本身不被修改");
}

{
  const calls = [];
  const service = createStateService({
    root: "/lab",
    repositories: {
      getSeedGpuNodes() {
        calls.push({ name: "getSeedGpuNodes" });
        return [{ id: "seed-node" }];
      },
    },
    queryRealGpuNodes() {
      throw new Error("nvidia-smi unavailable");
    },
    nowText: () => "13:30",
  });

  assert.deepEqual(service.getGpuNodes(), {
    nodes: [{ id: "seed-node" }],
    monitor: { source: "seed", error: "nvidia-smi unavailable", updatedAt: "13:30" },
  });
  assert.deepEqual(names(calls), ["getSeedGpuNodes"]);
}

// A non-admin session cannot operate another student's sandbox.
{
  const { service } = createSandboxHarness({
    box: {
      id: "lab-rot-7",
      student: "陈曦",
      node_id: "node-a",
      gpus: 1,
      port: 8801,
      status: "running",
      snapshots: 1,
      container_id: "container-7",
      snapshot_image: "",
    },
  });
  assert.throws(
    () => service.toggleSandbox("lab-rot-7", { role: "student", displayName: "林可" }),
    (error) => error instanceof HttpError && error.status === 403,
  );
}

// Admins bypass the ownership check.
{
  const { calls, service } = createSandboxHarness();
  service.toggleSandbox("lab-rot-7", { role: "admin", displayName: "管理员" });
  assert.ok(calls.some((call) => call.name === "updateSandboxStatus"));
}

console.log("Server service tests passed");
