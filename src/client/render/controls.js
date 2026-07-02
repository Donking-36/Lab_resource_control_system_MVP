(function initControlRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.controls = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createControlPart() {
  function createControlRenderer({ documentRef, rules }) {
    const { predictTraining } = rules;

    function estimateHours() {
      const modelType = documentRef.querySelector("#modelType").value;
      const datasetSize = Number(documentRef.querySelector("#datasetSize").value);
      const epochCount = Number(documentRef.querySelector("#epochCount").value);
      const prediction = predictTraining(modelType, datasetSize, epochCount);
      documentRef.querySelector("#predictedHours").textContent = `${prediction.point} 小时`;
      documentRef.querySelector("#predictionHint").textContent =
        `区间 ${prediction.lower}–${prediction.upper} 小时 · ${prediction.confidence}置信度 · ${prediction.method}`;
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
