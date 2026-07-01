function createRequestService({
  repositories,
  docker,
  getGpuNodes,
  assertNumber,
  assertText,
  HttpError,
  applyAllocationToNode,
  selectGpuNode,
  nowText,
}) {
  function createRequest(body) {
    const student = assertText(body.student, "轮转生");
    const topic = assertText(body.topic, "研究方向");
    const dataset = assertText(body.dataset, "数据集挂载");
    const gpus = assertNumber(body.gpus, "GPU 数", 1, 8);
    const hours = assertNumber(body.hours, "预计时长", 1, 168);
    const urgency = assertNumber(body.urgency, "紧急程度", 1, 5);
    const image = assertText(body.image, "镜像模板");
    const credit = 80 + Math.floor(Math.random() * 18);

    repositories.insertRequest({
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
  }

  function approveRequest(id) {
    const request = repositories.getRequestById(id);
    if (!request) throw new HttpError(404, "申请不存在");
    if (request.status !== "waiting") throw new HttpError(409, "申请不在待分配状态");

    const gpu = getGpuNodes();
    const node = selectGpuNode(gpu.nodes, request.gpus);

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
      repositories.commit();
    } catch (error) {
      if (transactionStarted) repositories.rollback();
      docker.removeContainer({ container_id: container.containerId });
      throw error;
    }
  }

  function rejectRequest(id) {
    if (!repositories.rejectWaitingRequest(id)) throw new HttpError(404, "待驳回申请不存在");
  }

  return {
    createRequest,
    approveRequest,
    rejectRequest,
  };
}

module.exports = {
  createRequestService,
};
