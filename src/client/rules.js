(function initRules(root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = rules;
  } else {
    root.LabClientRules = rules;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function createRules() {
  const modelBaseHours = {
    segmentation: 0.018,
    detection: 0.012,
    llm: 0.026,
    classification: 0.006,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pct(value, total) {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  function priorityScore(request) {
    const urgencyWeight = Number(request.urgency) * 18;
    const releaseDiscipline = Math.min(20, Math.round(request.credit / 5));
    const gpuPenalty = Number(request.gpus) * 5;
    const durationPenalty = Math.min(20, Math.round(Number(request.hours) / 8));
    return urgencyWeight + releaseDiscipline - gpuPenalty - durationPenalty;
  }

  function estimateTrainingHours(modelType, datasetSize, epochCount) {
    const base = modelBaseHours[modelType] ?? modelBaseHours.classification;
    return Math.max(1, Math.round(Number(datasetSize) * Number(epochCount) * base));
  }

  function isRotationRisk(rotation) {
    return Number(rotation.gpuHours) > 60 && Number(rotation.lastUpdateDays) >= 5;
  }

  return {
    modelBaseHours,
    escapeHtml,
    pct,
    priorityScore,
    estimateTrainingHours,
    isRotationRisk,
  };
});
