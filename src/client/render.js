(function initRender(root, factory) {
  const renderApi = factory(root.LabRenderParts || {});
  if (typeof module === "object" && module.exports) {
    module.exports = renderApi;
  } else {
    root.LabRender = renderApi;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function createRender(parts) {
  function assertRenderParts() {
    const required = ["metrics", "gpu", "requests", "sandboxes", "rotations", "evaluations", "knowledge", "intelligence", "controls"];
    const missing = required.filter((name) => !parts[name]);
    if (missing.length) {
      throw new Error(`缺少前端渲染模块：${missing.join(", ")}`);
    }
  }

  function createRenderer({ state, els, documentRef, rules }) {
    assertRenderParts();

    const roleHints = {
      mentor: "导师视角关注进度风险、评分和知识沉淀。",
      student: "轮转生视角关注算力申请、训练预估和任务推进。",
      admin: "管理员视角关注节点资源、端口分配和沙箱生命周期。",
    };

    const metrics = parts.metrics.createMetricsRenderer({ state, els, rules });
    const gpu = parts.gpu.createGpuRenderer({ state, els, rules });
    const requests = parts.requests.createRequestRenderer({ state, els, rules });
    const sandboxes = parts.sandboxes.createSandboxRenderer({ state, els, rules });
    const rotations = parts.rotations.createRotationRenderer({ state, els, rules });
    const evaluations = parts.evaluations.createEvaluationRenderer({ state, els, rules });
    const knowledge = parts.knowledge.createKnowledgeRenderer({ state, els, documentRef, rules });
    const intelligence = parts.intelligence.createIntelligenceRenderer({ state, els, rules });
    const controls = parts.controls.createControlRenderer({ documentRef, rules });

    function renderRoleHint() {
      metrics.renderRoleHint(roleHints);
    }

    function renderAll() {
      renderRoleHint();
      metrics.renderMetrics();
      gpu.renderGpuGrid();
      requests.renderRequests();
      sandboxes.renderSandboxes();
      rotations.renderRotations();
      evaluations.renderEvaluations();
      knowledge.renderKnowledge();
      intelligence.renderIntelligence();
      controls.estimateHours();
      controls.applySearch();
    }

    return {
      applySearch: controls.applySearch,
      estimateHours: controls.estimateHours,
      renderAll,
      renderKnowledge: knowledge.renderKnowledge,
      renderRoleHint,
    };
  }

  return {
    createRenderer,
  };
});
