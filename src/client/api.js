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
  class ApiError extends Error {
    constructor(message, { status = 0, code = "NETWORK_ERROR", requestId = "" } = {}) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.requestId = requestId;
    }
  }

  async function apiRequest(path, options = {}) {
    let response;
    try {
      response = await fetchRef(path, {
        credentials: "same-origin",
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
      });
    } catch (error) {
      throw new ApiError(error.message || "网络连接失败，请检查后端服务", { code: "NETWORK_ERROR" });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(data.error || `请求失败：${response.status}`, {
        status: response.status,
        code: data.code || `HTTP_${response.status}`,
        requestId: data.requestId || response.headers?.get?.("x-request-id") || "",
      });
    }
    return data;
  }

  function getCurrentUser() {
    return apiRequest("/api/auth/me");
  }

  function login(username, password) {
    return apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  }

  function logout() {
    return apiRequest("/api/auth/logout", { method: "POST" });
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

  async function loadAlgorithmReport({ updateState, renderAll }) {
    const data = await apiRequest("/api/algorithm/report");
    updateState({ algorithmReport: data });
    renderAll();
    return data;
  }

  return {
    ApiError,
    apiRequest,
    getCurrentUser,
    login,
    logout,
    loadState,
    loadAlgorithmReport,
    mutate,
  };
});
