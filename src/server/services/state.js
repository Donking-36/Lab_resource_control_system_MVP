function createStateService({ root, repositories, queryRealGpuNodes, nowText }) {
  function upsertRealGpuNode(node) {
    repositories.upsertRealGpuNode(node, nowText());
  }

  function getGpuNodes() {
    try {
      const realNodes = queryRealGpuNodes(root);
      if (realNodes.length) {
        realNodes.forEach(upsertRealGpuNode);
        return {
          nodes: repositories.getGpuNodesBySource(),
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

  function getState() {
    const gpu = getGpuNodes();
    return {
      gpuNodes: gpu.nodes,
      gpuMonitor: gpu.monitor,
      requests: repositories.getRequests(),
      sandboxes: repositories.getSandboxes(),
      rotations: repositories.getRotations(),
      evaluations: repositories.getEvaluations(),
      knowledge: repositories.getKnowledge(),
    };
  }

  return {
    getGpuNodes,
    getState,
  };
}

module.exports = {
  createStateService,
};
