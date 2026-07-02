function createApiHandler({
  databasePath,
  docker,
  getGpuNodes,
  getState,
  createRequest,
  approveRequest,
  rejectRequest,
  scheduleNextRequest,
  releaseSandbox,
  toggleSandbox,
  snapshotSandbox,
  progressRotation,
  remindRotation,
  saveEvaluation,
  nowText,
  readJson,
  json,
  HttpError,
}) {
  function decodePathParam(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      throw new HttpError(400, "路径参数编码错误");
    }
  }

  return async function handleApi(req, res, pathname) {
    if (req.method === "GET" && pathname === "/api/health") {
      json(res, 200, { ok: true, database: databasePath, docker: docker.getDockerHealth(), time: nowText() });
      return;
    }
    if (req.method === "GET" && pathname === "/api/state") {
      json(res, 200, getState());
      return;
    }
    if (req.method === "GET" && pathname === "/api/gpu-nodes") {
      const gpu = getGpuNodes();
      json(res, 200, { gpuNodes: gpu.nodes, gpuMonitor: gpu.monitor });
      return;
    }
    if (req.method === "POST" && pathname === "/api/requests") {
      createRequest(await readJson(req));
      json(res, 201, getState());
      return;
    }
    if (req.method === "POST" && pathname === "/api/schedule/next") {
      const decision = scheduleNextRequest();
      json(res, 200, { ...getState(), scheduledDecision: decision });
      return;
    }

    const approveMatch = pathname.match(/^\/api\/requests\/(\d+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      approveRequest(Number(approveMatch[1]));
      json(res, 200, getState());
      return;
    }

    const rejectMatch = pathname.match(/^\/api\/requests\/(\d+)\/reject$/);
    if (req.method === "POST" && rejectMatch) {
      rejectRequest(Number(rejectMatch[1]));
      json(res, 200, getState());
      return;
    }

    const sandboxMatch = pathname.match(/^\/api\/sandboxes\/([^/]+)$/);
    if (req.method === "DELETE" && sandboxMatch) {
      releaseSandbox(decodePathParam(sandboxMatch[1]));
      json(res, 200, getState());
      return;
    }

    const sandboxActionMatch = pathname.match(/^\/api\/sandboxes\/([^/]+)\/(toggle|snapshot)$/);
    if (req.method === "POST" && sandboxActionMatch) {
      const id = decodePathParam(sandboxActionMatch[1]);
      if (sandboxActionMatch[2] === "toggle") toggleSandbox(id);
      if (sandboxActionMatch[2] === "snapshot") snapshotSandbox(id);
      json(res, 200, getState());
      return;
    }

    const rotationMatch = pathname.match(/^\/api\/rotations\/(\d+)\/(progress|remind)$/);
    if (req.method === "POST" && rotationMatch) {
      const id = Number(rotationMatch[1]);
      if (rotationMatch[2] === "progress") progressRotation(id);
      if (rotationMatch[2] === "remind") remindRotation(id);
      json(res, 200, getState());
      return;
    }

    if (req.method === "POST" && pathname === "/api/evaluations") {
      saveEvaluation(await readJson(req));
      json(res, 200, getState());
      return;
    }

    throw new HttpError(404, "接口不存在");
  };
}

module.exports = {
  createApiHandler,
};
