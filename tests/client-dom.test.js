const assert = require("node:assert/strict");

const { createDom, els: defaultEls } = require("../src/client/dom");

const expectedSelectors = {
  authLoading: "#authLoading",
  loginView: "#loginView",
  loginForm: "#loginForm",
  loginError: "#loginError",
  appShell: "#appShell",
  currentUserName: "#currentUserName",
  currentUserRole: "#currentUserRole",
  logoutBtn: "#logoutBtn",
  roleHint: "#roleHint",
  globalError: "#globalError",
  globalErrorMessage: "#globalErrorMessage",
  globalErrorMeta: "#globalErrorMeta",
  retryBtn: "#retryBtn",
  metricGpuUsage: "#metricGpuUsage",
  metricContainers: "#metricContainers",
  metricRisks: "#metricRisks",
  metricQueue: "#metricQueue",
  metricFairness: "#metricFairness",
  clusterStatus: "#clusterStatus",
  gpuGrid: "#gpuGrid",
  requestQueue: "#requestQueue",
  sandboxTable: "#sandboxTable",
  rotationList: "#rotationList",
  evaluationStudent: "#evaluationStudent",
  evaluationSummary: "#evaluationSummary",
  knowledgeGraph: "#knowledgeGraph",
  knowledgeList: "#knowledgeList",
  scheduleBoard: "#scheduleBoard",
  auditList: "#auditList",
  algorithmReportMeta: "#algorithmReportMeta",
  algorithmReportTable: "#algorithmReportTable",
  confirmDialog: "#confirmDialog",
  confirmMessage: "#confirmMessage",
  confirmAccept: "#confirmAccept",
  toast: "#toast",
};

{
  const queried = [];
  const documentRef = {
    querySelector(selector) {
      queried.push(selector);
      return { selector };
    },
  };

  const { els } = createDom(documentRef);

  Object.entries(expectedSelectors).forEach(([name, selector]) => {
    assert.deepEqual(els[name], { selector });
  });
  assert.deepEqual(queried, Object.values(expectedSelectors));
}

{
  Object.keys(expectedSelectors).forEach((name) => {
    assert.equal(defaultEls[name], undefined);
  });
  assert.equal(createDom(null).els.toast, undefined);
}

console.log("Client DOM tests passed");
