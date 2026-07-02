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
      authLoading: documentRef?.querySelector("#authLoading"),
      loginView: documentRef?.querySelector("#loginView"),
      loginForm: documentRef?.querySelector("#loginForm"),
      loginError: documentRef?.querySelector("#loginError"),
      appShell: documentRef?.querySelector("#appShell"),
      currentUserName: documentRef?.querySelector("#currentUserName"),
      currentUserRole: documentRef?.querySelector("#currentUserRole"),
      logoutBtn: documentRef?.querySelector("#logoutBtn"),
      roleHint: documentRef?.querySelector("#roleHint"),
      globalError: documentRef?.querySelector("#globalError"),
      globalErrorMessage: documentRef?.querySelector("#globalErrorMessage"),
      globalErrorMeta: documentRef?.querySelector("#globalErrorMeta"),
      retryBtn: documentRef?.querySelector("#retryBtn"),
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
      algorithmReportMeta: documentRef?.querySelector("#algorithmReportMeta"),
      algorithmReportTable: documentRef?.querySelector("#algorithmReportTable"),
      confirmDialog: documentRef?.querySelector("#confirmDialog"),
      confirmMessage: documentRef?.querySelector("#confirmMessage"),
      confirmAccept: documentRef?.querySelector("#confirmAccept"),
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
