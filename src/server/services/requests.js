function createRequestService({
  repositories,
  docker,
  getGpuNodes,
  assertNumber,
  assertText,
  HttpError,
  applyAllocationToNode,
  selectGpuNode,
  rankGpuNodes = (nodes, request) => {
    const node = selectGpuNode(nodes, request.gpus);
    return node ? [{ node }] : [];
  },
  buildSchedulingSnapshot = () => ({ decisions: [] }),
  nowText,
}) {
  function actorOf(user) {
    return user ? String(user.id) : "system";
  }

  function audit(action, entityId, details = {}, user = null) {
    repositories.appendAudit?.({
      action,
      entityType: "request",
      entityId,
      actor: actorOf(user),
      details,
      createdAt: nowText(),
    });
  }

  function createRequest(body, user = null) {
    // A non-admin session may only file requests under its own identity.
    const student =
      user && user.role !== "admin" ? user.displayName : assertText(body.student, "轮转生");
    const topic = assertText(body.topic, "研究方向");
    const dataset = assertText(body.dataset, "数据集挂载");
    const gpus = assertNumber(body.gpus, "GPU 数", 1, 8);
    const hours = assertNumber(body.hours, "预计时长", 1, 168);
    const urgency = assertNumber(body.urgency, "紧急程度", 1, 5);
    const image = assertText(body.image, "镜像模板");
    const credit = 85;

    const result = repositories.insertRequest({
      student,
      topic,
      dataset,
      gpus,
      hours,
      urgency,
      image,
      credit,
      createdAt: nowText(),
    });
    audit("request.created", result?.lastInsertRowid || "new", { student, gpus, hours, urgency, image }, user);
  }

  function approveRequest(id, suppliedDecision = null, user = null) {
    const request = repositories.getRequestById(id);
    if (!request) throw new HttpError(404, "申请不存在");
    if (request.status !== "waiting") throw new HttpError(409, "申请不在待分配状态");

    const gpu = getGpuNodes();
    let schedulingDecision = suppliedDecision;
    if (!schedulingDecision && repositories.getRequests && repositories.getSandboxes) {
      schedulingDecision = buildSchedulingSnapshot({
        requests: repositories.getRequests(),
        sandboxes: repositories.getSandboxes(),
        gpuNodes: gpu.nodes,
      }).decisions.find((decision) => decision.requestId === id);
    }
    const nodeDecision = rankGpuNodes(gpu.nodes, request)[0];
    const node = nodeDecision?.node || selectGpuNode(gpu.nodes, request.gpus);

    if (!node) throw new HttpError(409, "当前没有满足条件的 GPU 节点或空闲端口");

    const ports = [...node.ports];
    const port = ports.shift();
    const container = docker.createDockerContainer({
      request,
      port,
      name: docker.makeContainerName(id),
    });

    let transactionStarted = false;
    try {
      repositories.begin();
      transactionStarted = true;
      const allocation = applyAllocationToNode(node, request, ports, nowText());
      repositories.updateNodeAllocation(node.id, allocation);
      repositories.markRequestAllocated(id);
      repositories.insertSandboxFromAllocation({
        id: `lab-rot-${id}`,
        request,
        nodeId: node.id,
        port,
        container,
        createdAt: nowText(),
      });
      audit("request.allocated", id, {
        student: request.student,
        nodeId: node.id,
        nodeScore: nodeDecision?.score,
        algorithm: schedulingDecision ? "xfs-v1" : "manual-compatible",
        requestScore: schedulingDecision?.score,
        scoreComponents: schedulingDecision?.components,
        gpus: request.gpus,
        port,
      }, user);
      repositories.commit();
    } catch (error) {
      if (transactionStarted) repositories.rollback();
      docker.removeContainer({ container_id: container.containerId });
      throw error;
    }
  }

  function rejectRequest(id, user = null) {
    if (!repositories.rejectWaitingRequest(id)) throw new HttpError(404, "待驳回申请不存在");
    audit("request.rejected", id, {}, user);
  }

  function scheduleNextRequest(user = null) {
    const gpu = getGpuNodes();
    const scheduling = buildSchedulingSnapshot({
      requests: repositories.getRequests(),
      sandboxes: repositories.getSandboxes(),
      gpuNodes: gpu.nodes,
    });
    const next = scheduling.decisions.find((decision) => decision.eligible);
    if (!next) throw new HttpError(409, "当前没有可调度的申请或可用资源");
    approveRequest(next.requestId, next, user);
    return next;
  }

  return {
    createRequest,
    approveRequest,
    rejectRequest,
    scheduleNextRequest,
  };
}

module.exports = {
  createRequestService,
};
