(function initIntelligenceRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.intelligence = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createIntelligencePart() {
  function createIntelligenceRenderer({ state, els, rules }) {
    const { escapeHtml } = rules;
    const actionLabels = {
      "request.created": "提交算力申请",
      "request.allocated": "分配算力与容器",
      "request.rejected": "驳回申请",
      "sandbox.released": "释放沙箱",
      "sandbox.running": "恢复沙箱",
      "sandbox.paused": "暂停沙箱",
      "sandbox.snapshotted": "创建环境快照",
      "rotation.progressed": "推进轮转节点",
      "rotation.reminded": "记录进度提醒",
      "evaluation.saved": "保存导师评分",
    };

    function renderIntelligence() {
      const decisions = state.scheduling?.decisions || [];
      els.scheduleBoard.innerHTML = decisions.length
        ? decisions.slice(0, 4).map((item) => `
            <article class="decision-row">
              <span class="decision-rank">#${item.rank}</span>
              <div><strong>${escapeHtml(item.student)}</strong><small>${item.gpuHours} GPU·h · ${item.eligible ? escapeHtml(item.recommendedNode?.name || "待定") : "资源不足"}</small></div>
              <strong>${item.score}</strong>
            </article>`).join("")
        : `<p class="empty-note">当前没有待调度申请。</p>`;

      els.auditList.innerHTML = (state.auditEvents || []).length
        ? state.auditEvents.slice(0, 8).map((event) => `
            <article class="audit-row">
              <span>${escapeHtml(event.createdAt)}</span>
              <div><strong>${escapeHtml(actionLabels[event.action] || event.action)}</strong><small>${escapeHtml(event.entityType)} · ${escapeHtml(event.entityId)}</small></div>
            </article>`).join("")
        : `<p class="empty-note">尚无操作事件；下一次变更将形成可追溯审计记录。</p>`;
    }

    return { renderIntelligence };
  }
  return { createIntelligenceRenderer };
});
