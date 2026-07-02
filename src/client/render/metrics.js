(function initMetricRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.metrics = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createMetricPart() {
  function createMetricsRenderer({ state, els, rules }) {
    const { isRotationRisk, pct } = rules;

    function renderRoleHint(roleHints) {
      const role = state.user?.role || "student";
      els.roleHint.textContent = roleHints[role] ?? roleHints.student;
    }

    function renderMetrics() {
      const totalGpu = state.gpuNodes.reduce((sum, node) => sum + Number(node.totalGpu), 0);
      const usedGpu = state.gpuNodes.reduce((sum, node) => sum + Number(node.usedGpu), 0);
      const risks = state.rotations.filter(isRotationRisk).length;
      const waiting = state.requests.filter((request) => request.status === "waiting").length;

      els.metricGpuUsage.textContent = `${pct(usedGpu, totalGpu)}%`;
      els.metricContainers.textContent = String(state.sandboxes.filter((box) => box.status === "running").length);
      els.metricRisks.textContent = String(risks);
      els.metricQueue.textContent = String(waiting);
      if (els.metricFairness) els.metricFairness.textContent = Number(state.scheduling?.fairnessIndex ?? 1).toFixed(3);

      const hotNodes = state.gpuNodes.filter((node) => pct(node.usedGpu, node.totalGpu) >= 90).length;
      const source = state.gpuMonitor?.source === "nvidia-smi" ? "真实 GPU" : "种子数据";
      els.clusterStatus.textContent = hotNodes ? `${hotNodes} 个节点高负载 · ${source}` : `运行正常 · ${source}`;
      els.clusterStatus.className = hotNodes ? "status-pill amber" : "status-pill";
    }

    return {
      renderMetrics,
      renderRoleHint,
    };
  }

  return {
    createMetricsRenderer,
  };
});
