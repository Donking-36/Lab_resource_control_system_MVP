function createStateService({
  root,
  repositories,
  queryRealGpuNodes,
  nowText,
  buildSchedulingSnapshot = () => ({ algorithm: "unavailable", fairnessIndex: 1, decisions: [] }),
}) {
  function upsertRealGpuNode(node) {
    repositories.upsertRealGpuNode(node, nowText());
  }

  function getGpuNodes() {
    try {
      const realNodes = queryRealGpuNodes(root);
      if (realNodes.length) {
        realNodes.forEach(upsertRealGpuNode);
        // 利用率是瞬时读数，不入库：把刚从 nvidia-smi 读到的值叠加到数据库行上，
        // 前端据此显示真实占用百分比（种子节点无此字段，回退到整卡计数）。
        const utilizationById = new Map(realNodes.map((node) => [node.id, node.utilization]));
        return {
          nodes: repositories.getGpuNodesBySource().map((node) => {
            const utilization = utilizationById.get(node.id);
            return Number.isFinite(utilization) ? { ...node, utilization } : node;
          }),
          monitor: { source: "nvidia-smi", updatedAt: nowText() },
        };
      }
    } catch (error) {
      return {
        nodes: repositories.getSeedGpuNodes(),
        monitor: { source: "seed", error: error.message, updatedAt: nowText() },
      };
    }

    return {
      nodes: repositories.getGpuNodes(),
      monitor: { source: "seed", updatedAt: nowText() },
    };
  }

  function getState(user = null) {
    const gpu = getGpuNodes();
    const requests = repositories.getRequests();
    const sandboxes = repositories.getSandboxes();
    const rotations = repositories.getRotations();
    const evaluations = repositories.getEvaluations();
    const knowledge = repositories.getKnowledge();
    const scheduling = buildSchedulingSnapshot({ requests, sandboxes, gpuNodes: gpu.nodes });

    const base = {
      gpuNodes: gpu.nodes,
      gpuMonitor: gpu.monitor,
      requests,
      sandboxes,
      rotations,
      evaluations,
      knowledge,
      scheduling,
      auditEvents: repositories.getAuditEvents?.() || [],
      viewer: user ? { role: user.role, displayName: user.displayName } : null,
    };

    // No session (unit tests / internal callers) or admin: full visibility.
    if (!user || user.role === "admin") return base;

    // Student: only their own resources, no audit trail.
    if (user.role === "student") {
      const mine = user.displayName;
      return {
        ...base,
        requests: requests.filter((request) => request.student === mine),
        sandboxes: sandboxes.filter((box) => box.student === mine),
        rotations: rotations.filter((rotation) => rotation.student === mine),
        evaluations: evaluations.filter((evaluation) => evaluation.student === mine),
        scheduling: { ...scheduling, decisions: scheduling.decisions.filter((decision) => decision.student === mine) },
        auditEvents: [],
      };
    }

    // Mentor: read-only oversight of rotations/evaluations/requests, no audit.
    return { ...base, auditEvents: [] };
  }

  return {
    getGpuNodes,
    getState,
  };
}

module.exports = {
  createStateService,
};
