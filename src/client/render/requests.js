(function initRequestRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.requests = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createRequestPart() {
  function createRequestRenderer({ state, els, rules, permissions }) {
    const { escapeHtml, priorityScore } = rules;

    function renderRequests() {
      const decisions = new Map((state.scheduling?.decisions || []).map((item) => [item.requestId, item]));
      const queue = [...state.requests]
        .filter((request) => request.status === "waiting")
        .sort((a, b) => priorityScore(b) - priorityScore(a));

      if (!queue.length) {
        els.requestQueue.innerHTML = `<div class="queue-item"><p>当前没有待分配申请。</p></div>`;
        return;
      }

      els.requestQueue.innerHTML = queue
        .map((request) => {
          const decision = decisions.get(request.id);
          const score = decision?.score ?? priorityScore(request);
          const canReview = permissions.can(state.user, "request:review");
          return `
            <article class="queue-item">
              <header>
                <div>
                  <h3>${escapeHtml(request.student)} · ${escapeHtml(request.topic)}</h3>
                  <p>${escapeHtml(request.createdAt)} 提交 · ${escapeHtml(request.image)}</p>
                </div>
                <span class="chip">#${decision?.rank || "-"} · ${score} 分</span>
              </header>
              <div class="queue-meta">
                <span>GPU<strong>${request.gpus}</strong></span>
                <span>预计时长<strong>${request.hours}h</strong></span>
                <span>信用<strong>${request.credit}</strong></span>
                <span>紧急度<strong>${request.urgency}</strong></span>
              </div>
              ${decision ? `<p class="decision-detail">紧急 ${decision.components.urgency} · 信用 ${decision.components.credit} · 老化 ${decision.components.aging} · 效率 ${decision.components.efficiency} · 公平 ${decision.components.fairness} · 推荐 ${escapeHtml(decision.recommendedNode?.name || "暂无可用节点")}</p>` : ""}
              ${canReview ? `<div class="queue-actions">
                <button class="small-button" type="button" data-action="approve" data-id="${request.id}" data-pending-key="approve-${request.id}">批准分配</button>
                <button class="small-button danger" type="button" data-action="reject" data-id="${request.id}" data-pending-key="reject-${request.id}">驳回</button>
              </div>` : `<p class="permission-note">当前角色仅可查看申请状态。</p>`}
            </article>
          `;
        })
        .join("");
    }

    return {
      renderRequests,
    };
  }

  return {
    createRequestRenderer,
  };
});
