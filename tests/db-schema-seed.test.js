const assert = require("node:assert/strict");

const { createSchema, migrateSchema } = require("../src/server/db/schema");
const { seedData } = require("../src/server/db/seed");

function createFakeDb({ tableColumns = [], gpuNodeCount = 0 } = {}) {
  const calls = [];
  const prepared = [];

  return {
    calls,
    prepared,
    exec(sql) {
      calls.push({ type: "exec", sql });
    },
    prepare(sql) {
      prepared.push(sql);
      return {
        all() {
          calls.push({ type: "all", sql });
          if (sql === "PRAGMA table_info(sandboxes)") {
            return tableColumns.map((name) => ({ name }));
          }
          return [];
        },
        get() {
          calls.push({ type: "get", sql });
          if (sql === "SELECT COUNT(*) AS count FROM gpu_nodes") {
            return { count: gpuNodeCount };
          }
          return {};
        },
        run(...params) {
          calls.push({ type: "run", sql, params });
          return { lastInsertRowid: calls.filter((call) => call.type === "run").length };
        },
      };
    },
  };
}

{
  const db = createFakeDb();
  createSchema(db);
  const schemaSql = db.calls[0].sql;

  [
    "CREATE TABLE IF NOT EXISTS gpu_nodes",
    "CREATE TABLE IF NOT EXISTS requests",
    "CREATE TABLE IF NOT EXISTS sandboxes",
    "CREATE TABLE IF NOT EXISTS rotations",
    "CREATE TABLE IF NOT EXISTS rotation_stages",
    "CREATE TABLE IF NOT EXISTS evaluations",
    "CREATE TABLE IF NOT EXISTS knowledge",
    "CREATE TABLE IF NOT EXISTS audit_events",
  ].forEach((fragment) => assert.ok(schemaSql.includes(fragment), fragment));
}

{
  const db = createFakeDb({ tableColumns: ["id", "student"] });
  migrateSchema(db);
  const migrations = db.calls.filter((call) => call.type === "exec").map((call) => call.sql);

  assert.ok(migrations.includes("ALTER TABLE sandboxes ADD COLUMN container_id TEXT NOT NULL DEFAULT ''"));
  assert.ok(migrations.includes("ALTER TABLE sandboxes ADD COLUMN snapshot_image TEXT NOT NULL DEFAULT ''"));
}

{
  const existingColumns = [
    "container_id",
    "container_name",
    "host_port",
    "container_port",
    "mount_path",
    "created_at",
    "last_error",
    "snapshot_image",
  ];
  const db = createFakeDb({ tableColumns: existingColumns });
  migrateSchema(db);

  assert.equal(db.calls.filter((call) => call.type === "exec").length, 0);
}

{
  const db = createFakeDb({ gpuNodeCount: 1 });
  seedData(db, () => "now");

  assert.deepEqual(db.calls, [{ type: "get", sql: "SELECT COUNT(*) AS count FROM gpu_nodes" }]);
}

{
  const db = createFakeDb({ gpuNodeCount: 0 });
  seedData(db, () => "now");

  const runCalls = db.calls.filter((call) => call.type === "run");
  assert.equal(runCalls.filter((call) => call.sql.includes("INSERT INTO gpu_nodes")).length, 4);
  assert.equal(runCalls.filter((call) => call.sql.includes("INSERT INTO requests")).length, 2);
  assert.equal(runCalls.filter((call) => call.sql.includes("INSERT INTO sandboxes")).length, 2);
  assert.equal(runCalls.filter((call) => call.sql.includes("INSERT INTO rotations")).length, 3);
  assert.equal(runCalls.filter((call) => call.sql.includes("INSERT INTO rotation_stages")).length, 15);
  assert.equal(runCalls.filter((call) => call.sql.includes("INSERT INTO evaluations")).length, 2);
  assert.equal(runCalls.filter((call) => call.sql.includes("INSERT INTO knowledge")).length, 3);
}

console.log("DB schema and seed tests passed");
