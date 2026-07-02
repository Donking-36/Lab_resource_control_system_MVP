const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

// Runs SQLite's own integrity and foreign-key diagnostics against a database
// file. Returns { ok, integrity, foreignKeyViolations }.
function checkDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return { ok: false, reason: `数据库不存在：${dbPath}` };
  }
  const db = new DatabaseSync(dbPath);
  try {
    const integrity = db
      .prepare("PRAGMA integrity_check")
      .all()
      .map((row) => row.integrity_check ?? Object.values(row)[0]);
    const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all();
    const integrityOk = integrity.length === 1 && integrity[0] === "ok";
    return { ok: integrityOk && foreignKeyViolations.length === 0, integrity, foreignKeyViolations };
  } finally {
    db.close();
  }
}

module.exports = {
  checkDatabase,
};

if (require.main === module) {
  const { DB_PATH } = require("../src/server/config");
  const result = checkDatabase(DB_PATH);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
