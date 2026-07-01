(function initControlRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.controls = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createControlPart() {
  function createControlRenderer({ documentRef, rules }) {
    const { estimateTrainingHours } = rules;

    function estimateHours() {
      const modelType = documentRef.querySelector("#modelType").value;
      const datasetSize = Number(documentRef.querySelector("#datasetSize").value);
      const epochCount = Number(documentRef.querySelector("#epochCount").value);
      const hours = estimateTrainingHours(modelType, datasetSize, epochCount);
      documentRef.querySelector("#predictedHours").textContent = `${hours} 小时`;
      documentRef.querySelector("#predictionHint").textContent =
        hours > 48 ? "建议拆分阶段并设置释放提醒" : "可进入常规申请队列";
    }

    function applySearch() {
      const term = documentRef.querySelector("#globalSearch").value.trim().toLowerCase();
      documentRef.querySelectorAll(".queue-item, .rotation-card, .knowledge-item").forEach((card) => {
        const matched = !term || card.textContent.toLowerCase().includes(term);
        card.style.display = matched ? "" : "none";
      });
    }

    return {
      applySearch,
      estimateHours,
    };
  }

  return {
    createControlRenderer,
  };
});
