function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gpu_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gpu TEXT NOT NULL,
      total_gpu INTEGER NOT NULL,
      used_gpu INTEGER NOT NULL,
      memory_total INTEGER NOT NULL,
      memory_used INTEGER NOT NULL,
      mount TEXT NOT NULL,
      ports_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student TEXT NOT NULL,
      topic TEXT NOT NULL,
      gpus INTEGER NOT NULL,
      hours INTEGER NOT NULL,
      urgency INTEGER NOT NULL,
      image TEXT NOT NULL,
      dataset TEXT NOT NULL,
      credit INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandboxes (
      id TEXT PRIMARY KEY,
      student TEXT NOT NULL,
      node_id TEXT NOT NULL,
      gpus INTEGER NOT NULL,
      port INTEGER NOT NULL,
      image TEXT NOT NULL,
      dataset TEXT NOT NULL,
      status TEXT NOT NULL,
      snapshots INTEGER NOT NULL DEFAULT 0,
      container_id TEXT NOT NULL DEFAULT '',
      container_name TEXT NOT NULL DEFAULT '',
      host_port INTEGER NOT NULL DEFAULT 0,
      container_port INTEGER NOT NULL DEFAULT 8888,
      mount_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      snapshot_image TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student TEXT NOT NULL,
      topic TEXT NOT NULL,
      gpu_hours INTEGER NOT NULL,
      last_update_days INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rotation_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rotation_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      progress INTEGER NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (rotation_id) REFERENCES rotations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student TEXT NOT NULL UNIQUE,
      score INTEGER NOT NULL,
      code INTEGER NOT NULL,
      efficiency INTEGER NOT NULL,
      delivery INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      owner TEXT NOT NULL,
      ancestor TEXT NOT NULL,
      issue TEXT NOT NULL,
      solution TEXT NOT NULL,
      repo TEXT NOT NULL
    );
  `);
}

function migrateSchema(db) {
  const columns = db.prepare("PRAGMA table_info(sandboxes)").all().map((column) => column.name);
  const migrations = [
    ["container_id", "TEXT NOT NULL DEFAULT ''"],
    ["container_name", "TEXT NOT NULL DEFAULT ''"],
    ["host_port", "INTEGER NOT NULL DEFAULT 0"],
    ["container_port", "INTEGER NOT NULL DEFAULT 8888"],
    ["mount_path", "TEXT NOT NULL DEFAULT ''"],
    ["created_at", "TEXT NOT NULL DEFAULT ''"],
    ["last_error", "TEXT NOT NULL DEFAULT ''"],
    ["snapshot_image", "TEXT NOT NULL DEFAULT ''"],
  ];

  migrations.forEach(([name, definition]) => {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE sandboxes ADD COLUMN ${name} ${definition}`);
    }
  });
}

module.exports = {
  createSchema,
  migrateSchema,
};
