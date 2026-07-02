const fs = require("node:fs");
const path = require("node:path");

const dbPath = path.resolve(__dirname, "../data/e2e-lab-resource.db");
[dbPath, `${dbPath}-shm`, `${dbPath}-wal`].forEach((file) => fs.rmSync(file, { force: true }));

process.env.PORT = process.env.PORT || "3210";
process.env.LAB_MVP_DB = dbPath;
process.env.LAB_SEED_TEST_USERS = "1";
process.env.LAB_DOCKER_MODE = "mock";

require("../server");
