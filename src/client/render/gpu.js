(function initGpuRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.gpu = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createGpuPart() {
  function createGpuRenderer({ state, els, rules }) {
    const { escapeHtml, pct } = rules;

    function renderGpuGrid() {
      if (!state.gpuNodes.length) {
        els.gpuGrid.innerHTML = `<article class="gpu-card"><p>暂无 GPU 节点数据，请确认后端服务已启动。</p></article>`;
        return;
      }

      els.gpuGrid.innerHTML = state.gpuNodes
        .map((node) => {
          const gpuPct = pct(node.usedGpu, node.totalGpu);
          const memPct = pct(node.memoryUsed, node.memoryTotal);
          const chipClass = gpuPct >= 90 ? "chip red" : gpuPct >= 70 ? "chip amber" : "chip";
          const ports = Array.isArray(node.ports) ? node.ports : [];
          return `
            <article class="gpu-card">
              <header>
                <div>
                  <h3>${escapeHtml(node.name)}</h3>
                  <p>${escapeHtml(node.gpu)} · ${escapeHtml(node.mount)}</p>
                </div>
                <span class="${chipClass}">${Math.max(0, node.totalGpu - node.usedGpu)} GPU 空闲</span>
              </header>
              <div class="bar-stack">
                <div class="bar-row">
                  <label><span>GPU 占用</span><strong>${gpuPct}%</strong></label>
                  <div class="bar"><span class="${gpuPct >= 90 ? "hot" : ""}" style="width:${gpuPct}%"></span></div>
                </div>
                <div class="bar-row">
                  <label><span>显存占用</span><strong>${node.memoryUsed}/${node.memoryTotal} GB</strong></label>
                  <div class="bar"><span class="${memPct >= 90 ? "hot" : ""}" style="width:${memPct}%"></span></div>
                </div>
              </div>
              <div class="port-row">
                ${ports.map((port) => `<span>${port}</span>`).join("") || "<span>无空闲端口</span>"}
              </div>
            </article>
          `;
        })
        .join("");
    }

    return {
      renderGpuGrid,
    };
  }

  return {
    createGpuRenderer,
  };
});
