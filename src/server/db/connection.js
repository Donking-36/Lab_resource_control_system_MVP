const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

function createConnection(dbPath, dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

module.exports = {
  createConnection,
};
