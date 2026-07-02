const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

function createConnection(dbPath, dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = NORMAL");
  return db;
}

module.exports = {
  createConnection,
};
