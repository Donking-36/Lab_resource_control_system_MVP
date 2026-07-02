(function initState(root, factory) {
  const stateApi = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = stateApi;
  } else {
    root.LabState = stateApi;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function createState() {
  const state = {
    gpuNodes: [],
    requests: [],
    sandboxes: [],
    rotations: [],
    evaluations: [],
    knowledge: [],
    auditEvents: [],
    scheduling: { algorithm: "loading", fairnessIndex: 1, decisions: [] },
    algorithmReport: null,
    gpuMonitor: { source: "loading" },
    authStatus: "checking",
    user: null,
    globalError: null,
    pendingActions: {},
  };

  function updateState(data) {
    Object.assign(state, data);
  }

  return {
    state,
    updateState,
  };
});
