const fs = require("node:fs");
const path = require("node:path");

// Copies the SQLite database (and its WAL/SHM sidecars, if present) into a
// timestamped file. Returns the backup path, or null when there is nothing yet.
function backupDatabase(dbPath, backupsDir) {
  if (!fs.existsSync(dbPath)) return null;
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.basename(dbPath, path.extname(dbPath));
  const target = path.join(backupsDir, `${base}-${stamp}.db`);
  fs.copyFileSync(dbPath, target);
  ["-wal", "-shm"].forEach((suffix) => {
    const sidecar = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, `${target}${suffix}`);
  });
  return target;
}

module.exports = {
  backupDatabase,
};

if (require.main === module) {
  const { DB_PATH } = require("../src/server/config");
  const backupsDir = path.join(path.dirname(DB_PATH), "backups");
  const target = backupDatabase(DB_PATH, backupsDir);
  if (target) {
    console.log(`数据库已备份到 ${target}`);
  } else {
    console.log(`未找到数据库 ${DB_PATH}，无需备份。`);
  }
}
