(function initApi(root, factory) {
  const fetchRef =
    typeof root.fetch === "function"
      ? root.fetch.bind(root)
      : async function missingFetch() {
          throw new Error("fetch 不可用");
        };
  const api = factory(fetchRef);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.LabApi = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function createApi(fetchRef) {
  async function apiRequest(path, options = {}) {
    const response = await fetchRef(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `请求失败：${response.status}`);
    }
    return data;
  }

  async function loadState({ updateState, renderAll }) {
    const data = await apiRequest("/api/state");
    updateState(data);
    renderAll();
  }

  async function mutate(path, options = {}, { updateState, renderAll }) {
    const data = await apiRequest(path, options);
    updateState(data);
    renderAll();
    return data;
  }

  return {
    apiRequest,
    loadState,
    mutate,
  };
});
