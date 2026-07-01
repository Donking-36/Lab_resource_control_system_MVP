const http = require("node:http");
const { ROOT, DATA_DIR, DB_PATH, PORT, CONTAINER_PORT, IMAGE_TEMPLATES } = require("./src/server/config");
const { createDockerAdapter } = require("./src/server/adapters/docker");
const { queryRealGpuNodes } = require("./src/server/adapters/gpuMonitor");
const { createApp } = require("./src/server/app");
const { createConnection } = require("./src/server/db/connection");
const { createRepositories } = require("./src/server/db/repositories");
const { createSchema, migrateSchema } = require("./src/server/db/schema");
const { seedData } = require("./src/server/db/seed");
const { HttpError } = require("./src/server/errors");
const { assertNumber, assertText, json, readJson } = require("./src/server/http");
const { createApiHandler } = require("./src/server/routes/api");
const { createStaticHandler } = require("./src/server/routes/static");
const { applyAllocationToNode, returnPortToNode, selectGpuNode } = require("./src/server/rules");
const { createEvaluationService } = require("./src/server/services/evaluations");
const { createRequestService } = require("./src/server/services/requests");
const { createRotationService } = require("./src/server/services/rotations");
const { createSandboxService } = require("./src/server/services/sandboxes");
const { createStateService } = require("./src/server/services/state");
const { nowText } = require("./src/server/time");

const db = createConnection(DB_PATH, DATA_DIR);
const docker = createDockerAdapter({
  containerPort: CONTAINER_PORT,
  imageTemplates: IMAGE_TEMPLATES,
  HttpError,
});
const repositories = createRepositories(db, {
  containerPort: CONTAINER_PORT,
  inspectContainerStatus: docker.inspectContainerStatus,
});

createSchema(db);
migrateSchema(db);
seedData(db, nowText);

const stateService = createStateService({
  root: ROOT,
  repositories,
  queryRealGpuNodes,
  nowText,
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
  nowText,
});
const sandboxService = createSandboxService({
  repositories,
  docker,
  HttpError,
  returnPortToNode,
  nowText,
});
const rotationService = createRotationService({ repositories, HttpError });
const evaluationService = createEvaluationService({ repositories, assertNumber, assertText });

const handleApi = createApiHandler({
  databasePath: DB_PATH,
  docker,
  getGpuNodes: stateService.getGpuNodes,
  getState: stateService.getState,
  createRequest: requestService.createRequest,
  approveRequest: requestService.approveRequest,
  rejectRequest: requestService.rejectRequest,
  releaseSandbox: sandboxService.releaseSandbox,
  toggleSandbox: sandboxService.toggleSandbox,
  snapshotSandbox: sandboxService.snapshotSandbox,
  progressRotation: rotationService.progressRotation,
  remindRotation: rotationService.remindRotation,
  saveEvaluation: evaluationService.saveEvaluation,
  nowText,
  readJson,
  json,
  HttpError,
});
const serveStatic = createStaticHandler({ root: ROOT, HttpError });
const handleRequest = createApp({ handleApi, serveStatic, HttpError, json });

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`Lab Resource MVP backend running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
