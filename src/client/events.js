(function initEvents(root, factory) {
  const eventsApi = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = eventsApi;
  } else {
    root.LabEvents = eventsApi;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function createEvents() {
  function createEventHandlers({
    state,
    els,
    documentRef,
    api,
    updateState,
    renderer,
    showToast,
    rules,
    confirmAction = async () => true,
    onApiError = () => {},
  }) {
    const { priorityScore } = rules;

    async function loadState() {
      await api.loadState({ updateState, renderAll: renderer.renderAll });
    }

    async function loadAlgorithmReport() {
      await api.loadAlgorithmReport({ updateState, renderAll: renderer.renderAll });
    }

    async function mutate(path, options = {}) {
      updateState({ globalError: null });
      return api.mutate(path, options, { updateState, renderAll: renderer.renderAll });
    }

    function errorDetails(error) {
      return { message: error.message, code: error.code || "CLIENT_ERROR", requestId: error.requestId || "" };
    }

    async function runAction(key, action) {
      if (state.pendingActions?.[key]) return false;
      updateState({ pendingActions: { ...(state.pendingActions || {}), [key]: true }, globalError: null });
      renderer.renderChrome?.();
      try {
        await action();
        return true;
      } catch (error) {
        updateState({ globalError: errorDetails(error) });
        renderer.renderChrome?.();
        onApiError(error);
        showToast(error.message);
        return false;
      } finally {
        const pendingActions = { ...(state.pendingActions || {}) };
        delete pendingActions[key];
        updateState({ pendingActions });
        renderer.renderChrome?.();
      }
    }

    async function approveRequest(requestId) {
      await mutate(`/api/requests/${requestId}/approve`, { method: "POST" });
      showToast("申请已批准并写入数据库。");
    }

    async function rejectRequest(requestId) {
      await mutate(`/api/requests/${requestId}/reject`, { method: "POST" });
      showToast("申请已驳回。");
    }

    async function autoSchedule() {
      const queue = [...state.requests]
        .filter((request) => request.status === "waiting")
        .sort((a, b) => priorityScore(b) - priorityScore(a));

      if (!queue.length) {
        showToast("队列为空。");
        return;
      }

      await mutate("/api/schedule/next", { method: "POST" });
      showToast("公平调度器已执行，并记录可解释决策审计。");
    }

    async function releaseSandbox(boxId) {
      await mutate(`/api/sandboxes/${encodeURIComponent(boxId)}`, { method: "DELETE" });
      showToast("沙箱资源已释放并更新数据库。");
    }

    async function toggleSandbox(boxId) {
      await mutate(`/api/sandboxes/${encodeURIComponent(boxId)}/toggle`, { method: "POST" });
      showToast("沙箱状态已更新。");
    }

    async function snapshotSandbox(boxId) {
      await mutate(`/api/sandboxes/${encodeURIComponent(boxId)}/snapshot`, { method: "POST" });
      showToast("环境快照版本已更新。");
    }

    async function progressRotation(rotationId) {
      await mutate(`/api/rotations/${rotationId}/progress`, { method: "POST" });
      showToast("轮转节点进度已写入数据库。");
    }

    async function remindRotation(rotationId) {
      await mutate(`/api/rotations/${rotationId}/remind`, { method: "POST" });
      showToast("进度提醒已记录。");
    }

    async function saveEvaluation(event) {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const code = Number(formData.get("code"));
      const efficiency = Number(formData.get("efficiency"));
      const delivery = Number(formData.get("delivery"));
      const score = Math.round(code * 0.32 + efficiency * 0.34 + delivery * 0.34);

      await mutate("/api/evaluations", {
        method: "POST",
        body: JSON.stringify({
          student: formData.get("student"),
          score,
          code,
          efficiency,
          delivery,
        }),
      });
      showToast("导师评分已保存到数据库。");
    }

    async function submitRequest(event) {
      event.preventDefault();
      const formElement = event.currentTarget;
      const formData = new FormData(formElement);
      const student = formData.get("student").trim();
      const topic = formData.get("topic").trim();
      const dataset = formData.get("dataset").trim();

      if (!student || !topic || !dataset) {
        showToast("请补全学生、研究方向和数据集挂载路径。");
        return;
      }

      await mutate("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          student,
          topic,
          gpus: Number(formData.get("gpus")),
          hours: Number(formData.get("hours")),
          urgency: Number(formData.get("urgency")),
          image: formData.get("image"),
          dataset,
        }),
      });
      showToast("算力申请已保存到数据库。");
      formElement.reset();
    }

    async function refreshResources() {
      await loadState();
      const source = state.gpuMonitor?.source === "nvidia-smi" ? "真实 nvidia-smi" : "数据库种子数据";
      showToast(`资源状态已刷新：${source}。`);
    }

    function bindEvents() {
      documentRef.querySelector("#requestForm").addEventListener("submit", (event) => {
        runAction("request-submit", () => submitRequest(event));
      });
      documentRef.querySelector("#evaluationForm").addEventListener("submit", (event) => {
        runAction("evaluation-save", () => saveEvaluation(event));
      });
      documentRef.querySelector("#autoScheduleBtn").addEventListener("click", () => {
        runAction("auto-schedule", autoSchedule);
      });
      documentRef.querySelector("#refreshBtn").addEventListener("click", () => {
        runAction("refresh", refreshResources);
      });
      documentRef.querySelector("#knowledgeFilter").addEventListener("change", renderer.renderKnowledge);
      documentRef.querySelector("#globalSearch").addEventListener("input", renderer.applySearch);
      ["#modelType", "#datasetSize", "#epochCount"].forEach((selector) => {
        documentRef.querySelector(selector).addEventListener("input", renderer.estimateHours);
      });

      els.requestQueue.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = Number(button.dataset.id);
        if (button.dataset.action === "approve") runAction(`approve-${id}`, () => approveRequest(id));
        if (button.dataset.action === "reject") {
          confirmAction("驳回后该申请将退出待调度队列，确认继续吗？").then((confirmed) => {
            if (confirmed) runAction(`reject-${id}`, () => rejectRequest(id));
          });
        }
      });

      els.sandboxTable.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = button.dataset.id;
        if (button.dataset.action === "snapshot") runAction(`snapshot-${id}`, () => snapshotSandbox(id));
        if (button.dataset.action === "toggle") runAction(`toggle-${id}`, () => toggleSandbox(id));
        if (button.dataset.action === "release") {
          confirmAction("释放会删除容器并归还 GPU 与端口，此操作不可撤销。确认继续吗？").then((confirmed) => {
            if (confirmed) runAction(`release-${id}`, () => releaseSandbox(id));
          });
        }
      });

      els.rotationList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = Number(button.dataset.id);
        if (button.dataset.action === "progress") runAction(`progress-${id}`, () => progressRotation(id));
        if (button.dataset.action === "remind") runAction(`remind-${id}`, () => remindRotation(id));
      });
    }

    return {
      approveRequest,
      autoSchedule,
      bindEvents,
      loadAlgorithmReport,
      loadState,
      refreshResources,
      rejectRequest,
      releaseSandbox,
      remindRotation,
      progressRotation,
      saveEvaluation,
      snapshotSandbox,
      submitRequest,
      toggleSandbox,
      runAction,
    };
  }

  return {
    createEventHandlers,
  };
});
