const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { createSchema, migrateSchema } = require("../src/server/db/schema");
const { checkDatabase } = require("../scripts/db-check");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-mvp-mig-"));
const dbPath = path.join(dir, "old.db");

// A legacy database: pre-auth, with the old sandboxes shape (no container_* columns).
{
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student TEXT, topic TEXT, gpus INTEGER, hours INTEGER,
      urgency INTEGER, image TEXT, dataset TEXT, credit INTEGER, status TEXT, created_at TEXT
    );
    CREATE TABLE sandboxes (
      id TEXT PRIMARY KEY, student TEXT, node_id TEXT, gpus INTEGER, port INTEGER,
      image TEXT, dataset TEXT, status TEXT, snapshots INTEGER
    );
  `);
  db.prepare(
    "INSERT INTO requests (student, topic, gpus, hours, urgency, image, dataset, credit, status, created_at) VALUES ('赵明','x',1,4,3,'busybox-demo','/x',90,'waiting','09:00')",
  ).run();
  db.prepare(
    "INSERT INTO sandboxes (id, student, node_id, gpus, port, image, dataset, status, snapshots) VALUES ('lab-rot-1','赵明','node-a',1,8801,'busybox-demo','/x','running',0)",
  ).run();
  db.close();
}

// Apply the current schema + migrations to the legacy database.
{
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  createSchema(db);
  migrateSchema(db);

  // Existing rows are preserved.
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM requests").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM sandboxes").get().c, 1);

  // New auth tables are present.
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
  ["users", "sessions", "schema_meta"].forEach((table) => assert.ok(tables.includes(table), table));

  // Legacy sandboxes gained the container columns.
  const columns = db.prepare("PRAGMA table_info(sandboxes)").all().map((column) => column.name);
  ["container_id", "container_name", "host_port", "snapshot_image"].forEach((column) => assert.ok(columns.includes(column), column));

  // Schema version stamped.
  assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value, "2-auth");
  db.close();
}

// Integrity + foreign keys are clean after migration.
const result = checkDatabase(dbPath);
assert.equal(result.ok, true, JSON.stringify(result));

fs.rmSync(dir, { recursive: true, force: true });
console.log("DB migration tests passed");
