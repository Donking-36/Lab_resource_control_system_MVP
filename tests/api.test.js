const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(baseUrl, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  const init = { ...options, headers };

  if (options.body && typeof options.body !== "string") {
    init.body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body, text };
}

async function waitForServer(baseUrl, child, logs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before tests started.\n${logs.join("")}`);
    }

    try {
      const health = await request(baseUrl, "/api/health");
      if (health.status === 200 && health.body?.ok) return health.body;
    } catch {
      await delay(100);
    }
  }

  throw new Error(`Timed out waiting for API server.\n${logs.join("")}`);
}

function findById(items, id) {
  return items.find((item) => item.id === id);
}

async function main() {
  const port = await getFreePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-mvp-api-"));
  const datasetDir = path.join(tempDir, "dataset");
  const dbPath = path.join(tempDir, "test.db");
  fs.mkdirSync(datasetDir);

  const logs = [];
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      LAB_MVP_DB: dbPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await waitForServer(baseUrl, child, logs);
    assert.equal(health.ok, true);
    assert.equal(typeof health.database, "string");

    const state = await request(baseUrl, "/api/state");
    assert.equal(state.status, 200);
    assert.ok(Array.isArray(state.body.gpuNodes));
    assert.ok(Array.isArray(state.body.requests));
    assert.ok(Array.isArray(state.body.sandboxes));
    assert.ok(Array.isArray(state.body.rotations));
    assert.ok(Array.isArray(state.body.evaluations));
    assert.ok(Array.isArray(state.body.knowledge));

    const gpuNodes = await request(baseUrl, "/api/gpu-nodes");
    assert.equal(gpuNodes.status, 200);
    assert.ok(Array.isArray(gpuNodes.body.gpuNodes));
    assert.equal(typeof gpuNodes.body.gpuMonitor.source, "string");

    const invalidRequest = await request(baseUrl, "/api/requests", {
      method: "POST",
      body: {
        student: "",
        topic: "医学图像分割",
        gpus: 0,
        hours: 0,
        urgency: 9,
        image: "pytorch-2.3-cuda12",
        dataset: datasetDir,
      },
    });
    assert.equal(invalidRequest.status, 400);
    assert.match(invalidRequest.body.error, /不能为空|必须/);

    const student = `API 测试学生 ${Date.now()}`;
    const createRequest = await request(baseUrl, "/api/requests", {
      method: "POST",
      body: {
        student,
        topic: "医学图像分割",
        gpus: 1,
        hours: 8,
        urgency: 3,
        image: "pytorch-2.3-cuda12",
        dataset: datasetDir,
      },
    });
    assert.equal(createRequest.status, 201);
    const created = createRequest.body.requests.find((item) => item.student === student);
    assert.ok(created);
    assert.equal(created.status, "waiting");

    const rejectRequest = await request(baseUrl, `/api/requests/${created.id}/reject`, { method: "POST" });
    assert.equal(rejectRequest.status, 200);
    assert.equal(rejectRequest.body.requests.find((item) => item.id === created.id).status, "rejected");

    const missingApproval = await request(baseUrl, "/api/requests/999999/approve", { method: "POST" });
    assert.equal(missingApproval.status, 404);

    const sandboxBefore = state.body.sandboxes[0];
    assert.ok(sandboxBefore);

    const snapshot = await request(baseUrl, `/api/sandboxes/${encodeURIComponent(sandboxBefore.id)}/snapshot`, {
      method: "POST",
    });
    assert.equal(snapshot.status, 200);
    assert.equal(findById(snapshot.body.sandboxes, sandboxBefore.id).snapshots, sandboxBefore.snapshots + 1);

    const toggle = await request(baseUrl, `/api/sandboxes/${encodeURIComponent(sandboxBefore.id)}/toggle`, {
      method: "POST",
    });
    assert.equal(toggle.status, 200);
    assert.equal(findById(toggle.body.sandboxes, sandboxBefore.id).status, "paused");

    const release = await request(baseUrl, `/api/sandboxes/${encodeURIComponent(sandboxBefore.id)}`, {
      method: "DELETE",
    });
    assert.equal(release.status, 200);
    assert.equal(findById(release.body.sandboxes, sandboxBefore.id), undefined);

    const rotationBefore = state.body.rotations.find((rotation) =>
      rotation.stages.some((stage) => stage.progress < 100),
    );
    const stageBefore = rotationBefore.stages.find((stage) => stage.progress < 100);
    const progress = await request(baseUrl, `/api/rotations/${rotationBefore.id}/progress`, { method: "POST" });
    assert.equal(progress.status, 200);
    const rotationAfter = findById(progress.body.rotations, rotationBefore.id);
    const stageAfter = findById(rotationAfter.stages, stageBefore.id);
    assert.equal(stageAfter.progress, Math.min(100, stageBefore.progress + 15));
    assert.equal(rotationAfter.lastUpdateDays, 0);

    const reminderTarget = progress.body.rotations.find((rotation) => rotation.lastUpdateDays > 0);
    const remind = await request(baseUrl, `/api/rotations/${reminderTarget.id}/remind`, { method: "POST" });
    assert.equal(remind.status, 200);
    assert.equal(
      findById(remind.body.rotations, reminderTarget.id).lastUpdateDays,
      Math.max(0, reminderTarget.lastUpdateDays - 2),
    );

    const evaluation = await request(baseUrl, "/api/evaluations", {
      method: "POST",
      body: {
        student,
        code: 90,
        efficiency: 80,
        delivery: 70,
        score: 80,
      },
    });
    assert.equal(evaluation.status, 200);
    assert.deepEqual(
      evaluation.body.evaluations.find((item) => item.student === student),
      { student, score: 80, code: 90, efficiency: 80, delivery: 70 },
    );

    const missingApi = await request(baseUrl, "/api/not-found");
    assert.equal(missingApi.status, 404);
    assert.match(missingApi.body.error, /接口不存在/);

    console.log("API tests passed");
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
