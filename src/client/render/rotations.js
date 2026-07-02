(function initRotationRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.rotations = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createRotationPart() {
  function createRotationRenderer({ state, els, rules, permissions }) {
    const { escapeHtml, isRotationRisk } = rules;

    function renderRotations() {
      els.rotationList.innerHTML = state.rotations
        .map((rotation) => {
          const avgProgress = Math.round(
            rotation.stages.reduce((sum, stage) => sum + Number(stage.progress), 0) / rotation.stages.length,
          );
          const risky = isRotationRisk(rotation);
          const stageRows = rotation.stages
            .map(
              (stage) => `
                <div class="gantt-row">
                  <span>${escapeHtml(stage.name)}</span>
                  <div class="timeline"><i class="${stage.progress ? "" : "pending"}" style="width:${stage.progress}%"></i></div>
                  <span>${stage.progress}%</span>
                </div>
              `,
            )
            .join("");
          return `
            <article class="rotation-card">
              <header>
                <div>
                  <h3>${escapeHtml(rotation.student)} · ${escapeHtml(rotation.topic)}</h3>
                  <p>GPU ${rotation.gpuHours} 小时 · ${rotation.lastUpdateDays} 天未更新 · 总进度 ${avgProgress}%</p>
                </div>
                <span class="${risky ? "chip amber" : "chip"}">${risky ? "触发提醒" : "进度正常"}</span>
              </header>
              <div class="gantt">${stageRows}</div>
              ${permissions.can(state.user, "rotation:manage") ? `<div class="rotation-actions">
                <button class="small-button" type="button" data-action="progress" data-id="${rotation.id}" data-pending-key="progress-${rotation.id}">推进节点</button>
                <button class="small-button" type="button" data-action="remind" data-id="${rotation.id}" data-pending-key="remind-${rotation.id}">发送提醒</button>
              </div>` : ""}
            </article>
          `;
        })
        .join("");
    }

    return {
      renderRotations,
    };
  }

  return {
    createRotationRenderer,
  };
});
