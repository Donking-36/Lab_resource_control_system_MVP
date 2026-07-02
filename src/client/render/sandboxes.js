(function initSandboxRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.sandboxes = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createSandboxPart() {
  function createSandboxRenderer({ state, els, rules, permissions }) {
    const { escapeHtml } = rules;

    function getNode(nodeId) {
      return state.gpuNodes.find((node) => node.id === nodeId);
    }

    function getNodeName(nodeId) {
      return getNode(nodeId)?.name ?? "未分配";
    }

    function renderSandboxes() {
      if (!state.sandboxes.length) {
        els.sandboxTable.innerHTML = `<tr><td colspan="12">暂无运行中的沙箱记录。</td></tr>`;
        return;
      }

      els.sandboxTable.innerHTML = state.sandboxes
        .map((box) => {
          const statusClass = box.status === "running" ? "chip" : "chip amber";
          return `
            <tr>
              <td>${escapeHtml(box.id)}</td>
              <td>${escapeHtml(box.containerShortId || "未创建")}</td>
              <td>${escapeHtml(box.student)}</td>
              <td>${escapeHtml(getNodeName(box.nodeId))}</td>
              <td>${box.gpus}</td>
              <td>${box.hostPort || box.port}:${box.containerPort || 8888}</td>
              <td>${escapeHtml(box.image)}</td>
              <td>${box.snapshots}${box.snapshotImage ? ` · ${escapeHtml(box.snapshotImage)}` : ""}</td>
              <td><span class="${statusClass}">${box.status === "running" ? "运行中" : "已暂停"}</span></td>
              <td>${escapeHtml(box.containerStatus || "未知")}</td>
              <td>${escapeHtml(box.lastError || "-")}</td>
              <td>
                ${permissions.can(state.user, "sandbox:manage") ? `
                <div class="sandbox-actions">
                  <button class="small-button" type="button" data-action="snapshot" data-id="${escapeHtml(box.id)}" data-pending-key="snapshot-${escapeHtml(box.id)}">快照</button>
                  <button class="small-button" type="button" data-action="toggle" data-id="${escapeHtml(box.id)}" data-pending-key="toggle-${escapeHtml(box.id)}">
                    ${box.status === "running" ? "暂停" : "恢复"}
                  </button>
                  <button class="small-button danger" type="button" data-action="release" data-id="${escapeHtml(box.id)}" data-pending-key="release-${escapeHtml(box.id)}">释放</button>
                </div>
                ` : `<span class="permission-note">只读</span>`}
              </td>
            </tr>
          `;
        })
        .join("");
    }

    return {
      renderSandboxes,
    };
  }

  return {
    createSandboxRenderer,
  };
});
