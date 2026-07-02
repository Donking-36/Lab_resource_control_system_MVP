const assert = require("node:assert/strict");

const { createRepositories } = require("../src/server/db/repositories");

function createFakeDb() {
  const calls = [];
  return {
    calls,
    exec(sql) {
      calls.push({ type: "exec", sql });
    },
    prepare(sql) {
      return {
        run(...params) {
          calls.push({ type: "run", sql, params });
          return { changes: 1 };
        },
        get(...params) {
          calls.push({ type: "get", sql, params });
          return { id: params[0] };
        },
        all(...params) {
          calls.push({ type: "all", sql, params });
          return [];
        },
      };
    },
  };
}

const db = createFakeDb();
const repositories = createRepositories(db, {
  containerPort: 8888,
  inspectContainerStatus: () => "unknown",
});

repositories.begin();
repositories.commit();
repositories.rollback();
assert.deepEqual(
  db.calls.filter((call) => call.type === "exec").map((call) => call.sql),
  ["BEGIN IMMEDIATE", "COMMIT", "ROLLBACK"],
);

repositories.insertRequest({
  student: "林可",
  topic: "医学图像分割",
  gpus: 1,
  hours: 14,
  urgency: 3,
  image: "busybox-demo",
  dataset: "/datasets/medical-seg",
  credit: 90,
  createdAt: "now",
});
assert.deepEqual(db.calls.at(-1).params, [
  "林可",
  "医学图像分割",
  1,
  14,
  3,
  "busybox-demo",
  "/datasets/medical-seg",
  90,
  "now",
]);

repositories.insertSandboxFromAllocation({
  id: "lab-rot-7",
  request: {
    student: "林可",
    gpus: 1,
    dataset: "/datasets/medical-seg",
  },
  nodeId: "node-a",
  port: 8801,
  container: {
    image: "busybox:latest",
    containerId: "abc",
    containerName: "lab-rot-7",
    containerPort: 8888,
    mountPath: "/datasets/medical-seg",
  },
  createdAt: "later",
});
assert.deepEqual(db.calls.at(-1).params, [
  "lab-rot-7",
  "林可",
  "node-a",
  1,
  8801,
  "busybox:latest",
  "/datasets/medical-seg",
  "abc",
  "lab-rot-7",
  8801,
  8888,
  "/datasets/medical-seg",
  "later",
]);

repositories.updateSandboxSnapshot("lab-rot-7", 2, "lab-snapshot:7-2");
assert.deepEqual(db.calls.at(-1).params, [2, "lab-snapshot:7-2", "lab-rot-7"]);

repositories.upsertEvaluation({
  student: "林可",
  score: 88,
  code: 90,
  efficiency: 85,
  delivery: 89,
});
assert.deepEqual(db.calls.at(-1).params, ["林可", 88, 90, 85, 89]);

console.log("Repository contract tests passed");
