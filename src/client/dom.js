(function initDom(root, factory) {
  const domApi = factory(root.document);
  if (typeof module === "object" && module.exports) {
    module.exports = domApi;
  } else {
    root.LabDom = domApi;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function createDomApi(defaultDocument) {
  function createDom(documentRef = defaultDocument) {
    const els = {
      roleSelect: documentRef?.querySelector("#roleSelect"),
      roleHint: documentRef?.querySelector("#roleHint"),
      metricGpuUsage: documentRef?.querySelector("#metricGpuUsage"),
      metricContainers: documentRef?.querySelector("#metricContainers"),
      metricRisks: documentRef?.querySelector("#metricRisks"),
      metricQueue: documentRef?.querySelector("#metricQueue"),
      metricFairness: documentRef?.querySelector("#metricFairness"),
      clusterStatus: documentRef?.querySelector("#clusterStatus"),
      gpuGrid: documentRef?.querySelector("#gpuGrid"),
      requestQueue: documentRef?.querySelector("#requestQueue"),
      sandboxTable: documentRef?.querySelector("#sandboxTable"),
      rotationList: documentRef?.querySelector("#rotationList"),
      evaluationStudent: documentRef?.querySelector("#evaluationStudent"),
      evaluationSummary: documentRef?.querySelector("#evaluationSummary"),
      knowledgeGraph: documentRef?.querySelector("#knowledgeGraph"),
      knowledgeList: documentRef?.querySelector("#knowledgeList"),
      scheduleBoard: documentRef?.querySelector("#scheduleBoard"),
      auditList: documentRef?.querySelector("#auditList"),
      toast: documentRef?.querySelector("#toast"),
    };

    return {
      els,
    };
  }

  const { els } = createDom(defaultDocument);

  return {
    createDom,
    els,
  };
});
