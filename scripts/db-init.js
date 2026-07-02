const { DB_PATH, DATA_DIR } = require("../src/server/config");
const { createConnection } = require("../src/server/db/connection");
const { createSchema, migrateSchema } = require("../src/server/db/schema");
const { seedData } = require("../src/server/db/seed");
const { nowText } = require("../src/server/time");

// Creates or migrates the database at DB_PATH and seeds baseline data, so tools
// like db:check have a real database to inspect without starting the server.
function initializeDatabase(dbPath = DB_PATH, dataDir = DATA_DIR) {
  const db = createConnection(dbPath, dataDir);
  createSchema(db);
  migrateSchema(db);
  seedData(db, nowText);
  db.close();
  return dbPath;
}

module.exports = {
  initializeDatabase,
};

if (require.main === module) {
  const target = initializeDatabase();
  console.log(`数据库已初始化：${target}`);
}
