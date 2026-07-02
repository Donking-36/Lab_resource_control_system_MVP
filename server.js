const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  ROOT,
  DATA_DIR,
  DB_PATH,
  PORT,
  CONTAINER_PORT,
  IMAGE_TEMPLATES,
  DOCKER_MODE,
  SESSION_TTL_MS,
  BOOTSTRAP_ADMIN_PASSWORD,
  SEED_TEST_USERS,
} = require("./src/server/config");
const { createDockerAdapter } = require("./src/server/adapters/docker");
const { createDockerMockAdapter } = require("./src/server/adapters/dockerMock");
const { queryRealGpuNodes } = require("./src/server/adapters/gpuMonitor");
const { createApp } = require("./src/server/app");
const { createConnection } = require("./src/server/db/connection");
const { createRepositories } = require("./src/server/db/repositories");
const { createSchema, migrateSchema } = require("./src/server/db/schema");
const { seedData } = require("./src/server/db/seed");
const { HttpError } = require("./src/server/errors");
const { assertNumber, assertText, json, readJson, parseCookies, setCookie } = require("./src/server/http");
const { authorize } = require("./src/server/rbac");
const { hashPassword, verifyPassword } = require("./src/server/auth/passwords");
const { createApiHandler } = require("./src/server/routes/api");
const { createAuthHandler, COOKIE_NAME } = require("./src/server/routes/auth");
const { createStaticHandler } = require("./src/server/routes/static");
const { applyAllocationToNode, returnPortToNode, selectGpuNode } = require("./src/server/rules");
const { buildSchedulingSnapshot, rankGpuNodes } = require("./src/server/scheduler");
const { runComparison } = require("./src/server/simulator");
const { createAuthService } = require("./src/server/services/auth");
const { createEvaluationService } = require("./src/server/services/evaluations");
const { createRequestService } = require("./src/server/services/requests");
const { createRotationService } = require("./src/server/services/rotations");
const { createSandboxService } = require("./src/server/services/sandboxes");
const { createStateService } = require("./src/server/services/state");
const { nowText } = require("./src/server/time");
const { backupDatabase } = require("./scripts/db-backup");

// Snapshot the existing database before applying migrations so a failed
// migration can always be rolled back from data/backups/.
if (fs.existsSync(DB_PATH)) {
  try {
    const target = backupDatabase(DB_PATH, path.join(path.dirname(DB_PATH), "backups"));
    if (target) console.log(`迁移前数据库备份：${target}`);
  } catch (error) {
    console.error(`数据库备份失败：${error.message}`);
  }
}

const db = createConnection(DB_PATH, DATA_DIR);
const docker =
  DOCKER_MODE === "mock"
    ? createDockerMockAdapter({ containerPort: CONTAINER_PORT, imageTemplates: IMAGE_TEMPLATES })
    : createDockerAdapter({ containerPort: CONTAINER_PORT, imageTemplates: IMAGE_TEMPLATES, HttpError });
const repositories = createRepositories(db, {
  containerPort: CONTAINER_PORT,
  inspectContainerStatus: docker.inspectContainerStatus,
});

createSchema(db);
migrateSchema(db);
seedData(db, nowText);

const auth = createAuthService({
  repositories,
  hashPassword,
  verifyPassword,
  sessionTtlMs: SESSION_TTL_MS,
  bootstrapAdminPassword: BOOTSTRAP_ADMIN_PASSWORD,
  seedTestUsers: SEED_TEST_USERS,
  nowText,
  HttpError,
});
auth.bootstrap();

const stateService = createStateService({
  root: ROOT,
  repositories,
  queryRealGpuNodes,
  nowText,
  buildSchedulingSnapshot,
});
const requestService = createRequestService({
  repositories,
  docker,
  getGpuNodes: stateService.getGpuNodes,
  assertNumber,
  assertText,
  HttpError,
  applyAllocationToNode,
  selectGpuNode,
  rankGpuNodes,
  buildSchedulingSnapshot,
  nowText,
});
const sandboxService = createSandboxService({
  repositories,
  docker,
  HttpError,
  returnPortToNode,
  nowText,
});
const rotationService = createRotationService({ repositories, HttpError, nowText });
const evaluationService = createEvaluationService({ repositories, assertNumber, assertText, nowText });

// The algorithm comparison is deterministic, so compute it once and cache it.
let cachedAlgorithmReport = null;
function getAlgorithmReport() {
  if (!cachedAlgorithmReport) cachedAlgorithmReport = runComparison();
  return cachedAlgorithmReport;
}

const handleApi = createApiHandler({
  databasePath: DB_PATH,
  docker,
  getGpuNodes: stateService.getGpuNodes,
  getState: stateService.getState,
  createRequest: requestService.createRequest,
  approveRequest: requestService.approveRequest,
  rejectRequest: requestService.rejectRequest,
  scheduleNextRequest: requestService.scheduleNextRequest,
  releaseSandbox: sandboxService.releaseSandbox,
  toggleSandbox: sandboxService.toggleSandbox,
  snapshotSandbox: sandboxService.snapshotSandbox,
  progressRotation: rotationService.progressRotation,
  remindRotation: rotationService.remindRotation,
  saveEvaluation: evaluationService.saveEvaluation,
  getAlgorithmReport,
  nowText,
  readJson,
  json,
  HttpError,
});
const handleAuth = createAuthHandler({ auth, readJson, json, setCookie, HttpError });
const serveStatic = createStaticHandler({ root: ROOT, HttpError });

function authenticateRequest(req) {
  const token = parseCookies(req)[COOKIE_NAME] || "";
  return { user: auth.authenticate(token), token };
}

function logger(fields) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}

const handleRequest = createApp({
  handleApi,
  serveStatic,
  handleAuth,
  authenticateRequest,
  authorize,
  logger,
  generateRequestId: () => crypto.randomUUID(),
  HttpError,
  json,
});

const server = http.createServer(handleRequest);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用，无法启动。`);
    console.error(`查询占用进程：lsof -i :${PORT}    (Windows: netstat -ano | findstr :${PORT})`);
    console.error(`更换端口启动：PORT=<其它端口> npm start`);
    process.exit(1);
  }
  console.error(`服务器启动失败：${error.message}`);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Lab Resource MVP backend running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
  console.log(`Docker mode: ${DOCKER_MODE}`);
  if (!BOOTSTRAP_ADMIN_PASSWORD && !SEED_TEST_USERS && repositories.countUsers() === 0) {
    console.log("提示：尚未创建任何账号。设置 LAB_BOOTSTRAP_ADMIN_PASSWORD 后重启即可创建管理员并启用登录。");
  }
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`收到 ${signal}，正在优雅退出...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // best effort
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, () => shutdown(signal)));
