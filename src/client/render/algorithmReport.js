(function initAlgorithmReportRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.algorithmReport = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createAlgorithmReportPart() {
  function createAlgorithmReportRenderer({ state, els, rules }) {
    const { escapeHtml } = rules;
    const labels = { fifo: "FIFO", sjf: "短作业优先", "xfs-v1": "XFS-V1" };
    const metrics = [
      ["avgWaitHours", "平均等待", "h"],
      ["p95WaitHours", "P95 等待", "h"],
      ["jainIndex", "Jain 公平", ""],
      ["gpuUtilization", "GPU 利用率", "%", 100],
      ["throughputPerHour", "吞吐量", "/h"],
      ["starvationRate", "饥饿率", "%", 100],
    ];

    function formatMetric(value, suffix, scale = 1) {
      const number = Number(value?.mean ?? value);
      return Number.isFinite(number) ? `${(number * scale).toFixed(scale === 100 ? 1 : 2)}${suffix}` : "-";
    }

    function renderAlgorithmReport() {
      const report = state.algorithmReport;
      if (!els.algorithmReportTable || !els.algorithmReportMeta) return;
      if (!report?.results) {
        els.algorithmReportMeta.textContent = "算法证据加载中…";
        els.algorithmReportTable.innerHTML = `<tr><td colspan="7">暂无算法报告</td></tr>`;
        return;
      }

      els.algorithmReportMeta.textContent =
        `${escapeHtml(report.algorithmVersion)} · ${report.trials} 轮 · 固定种子 ${report.seed}`;
      els.algorithmReportTable.innerHTML = Object.entries(report.results)
        .map(([name, result]) => `
          <tr class="${name === report.algorithmVersion ? "algorithm-winner" : ""}">
            <th scope="row">${escapeHtml(labels[name] || name)}</th>
            ${metrics.map(([key, , suffix, scale]) => `<td>${formatMetric(result[key], suffix, scale)}</td>`).join("")}
          </tr>`)
        .join("");
    }

    return { renderAlgorithmReport };
  }
  return { createAlgorithmReportRenderer };
});
