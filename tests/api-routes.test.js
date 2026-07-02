const assert = require("node:assert/strict");

const { HttpError } = require("../src/server/errors");
const { createApiHandler } = require("../src/server/routes/api");

function createResponse() {
  return {
    status: null,
    payload: null,
  };
}

function json(res, status, payload) {
  res.status = status;
  res.payload = payload;
}

function createHandler() {
  const calls = [];
  const state = { ok: "state" };
  const gpu = { nodes: [{ id: "node-a" }], monitor: { source: "seed" } };
  const handler = createApiHandler({
    databasePath: "/tmp/lab.db",
    docker: {
      getDockerHealth() {
        calls.push({ name: "getDockerHealth" });
        return { available: false };
      },
    },
    getGpuNodes() {
      calls.push({ name: "getGpuNodes" });
      return gpu;
    },
    getState() {
      calls.push({ name: "getState" });
      return state;
    },
    createRequest(body) {
      calls.push({ name: "createRequest", body });
    },
    approveRequest(id) {
      calls.push({ name: "approveRequest", id });
    },
    rejectRequest(id) {
      calls.push({ name: "rejectRequest", id });
    },
    scheduleNextRequest() {
      calls.push({ name: "scheduleNextRequest" });
      return { requestId: 7, score: 91.2 };
    },
    releaseSandbox(id) {
      calls.push({ name: "releaseSandbox", id });
    },
    toggleSandbox(id) {
      calls.push({ name: "toggleSandbox", id });
    },
    snapshotSandbox(id) {
      calls.push({ name: "snapshotSandbox", id });
    },
    progressRotation(id) {
      calls.push({ name: "progressRotation", id });
    },
    remindRotation(id) {
      calls.push({ name: "remindRotation", id });
    },
    saveEvaluation(body) {
      calls.push({ name: "saveEvaluation", body });
    },
    nowText: () => "14:00",
    readJson: async (req) => req.body || {},
    json,
    HttpError,
  });
  return { calls, handler, state, gpu };
}

async function request(handler, method, pathname, body) {
  const res = createResponse();
  await handler({ method, body }, res, pathname);
  return res;
}

(async () => {
  {
    const { calls, handler } = createHandler();
    const res = await request(handler, "GET", "/api/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.payload, {
      ok: true,
      database: "/tmp/lab.db",
      docker: { available: false },
      time: "14:00",
    });
    assert.deepEqual(calls.map((call) => call.name), ["getDockerHealth"]);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "GET", "/api/state");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls.map((call) => call.name), ["getState"]);
  }

  {
    const { calls, handler } = createHandler();
    const res = await request(handler, "POST", "/api/schedule/next");
    assert.equal(res.status, 200);
    assert.deepEqual(res.payload, { ok: "state", scheduledDecision: { requestId: 7, score: 91.2 } });
    assert.deepEqual(calls.map((call) => call.name), ["scheduleNextRequest", "getState"]);
  }

  {
    const { calls, handler, gpu } = createHandler();
    const res = await request(handler, "GET", "/api/gpu-nodes");
    assert.equal(res.status, 200);
    assert.deepEqual(res.payload, { gpuNodes: gpu.nodes, gpuMonitor: gpu.monitor });
    assert.deepEqual(calls.map((call) => call.name), ["getGpuNodes"]);
  }

  {
    const { calls, handler, state } = createHandler();
    const body = { student: "林可" };
    const res = await request(handler, "POST", "/api/requests", body);
    assert.equal(res.status, 201);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "createRequest", body },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "POST", "/api/requests/42/approve");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "approveRequest", id: 42 },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "POST", "/api/requests/42/reject");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "rejectRequest", id: 42 },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "DELETE", "/api/sandboxes/lab-rot-%E6%B5%8B%E8%AF%95");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "releaseSandbox", id: "lab-rot-测试" },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler } = createHandler();
    await assert.rejects(() => request(handler, "DELETE", "/api/sandboxes/%E0%A4%A"), (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "路径参数编码错误");
      return true;
    });
    assert.deepEqual(calls, []);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "POST", "/api/sandboxes/lab-rot-7/toggle");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "toggleSandbox", id: "lab-rot-7" },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "POST", "/api/sandboxes/lab-rot-7/snapshot");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "snapshotSandbox", id: "lab-rot-7" },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "POST", "/api/rotations/3/progress");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "progressRotation", id: 3 },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler, state } = createHandler();
    const res = await request(handler, "POST", "/api/rotations/3/remind");
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "remindRotation", id: 3 },
      { name: "getState" },
    ]);
  }

  {
    const { calls, handler, state } = createHandler();
    const body = { student: "林可", score: 88 };
    const res = await request(handler, "POST", "/api/evaluations", body);
    assert.equal(res.status, 200);
    assert.equal(res.payload, state);
    assert.deepEqual(calls, [
      { name: "saveEvaluation", body },
      { name: "getState" },
    ]);
  }

  {
    const { handler } = createHandler();
    await assert.rejects(() => request(handler, "GET", "/api/not-found"), (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, "接口不存在");
      return true;
    });
  }

  console.log("API route tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
