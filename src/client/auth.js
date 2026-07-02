(function initAuth(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LabAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function createAuthApi() {
  function createAuthManager({ api, updateState, onAuthenticated, onAnonymous, onError }) {
    function setAnonymous(error = null) {
      updateState({ authStatus: "anonymous", user: null, globalError: error, pendingActions: {} });
      onAnonymous?.();
    }

    async function restore() {
      updateState({ authStatus: "checking", globalError: null });
      try {
        const { user } = await api.getCurrentUser();
        if (!user) {
          setAnonymous();
          return null;
        }
        updateState({ authStatus: "authenticated", user, globalError: null });
        await onAuthenticated?.(user);
        return user;
      } catch (error) {
        setAnonymous({ message: error.message, code: error.code, requestId: error.requestId });
        onError?.(error);
        return null;
      }
    }

    async function login({ username, password }) {
      const cleanUsername = String(username || "").trim();
      if (!cleanUsername || !password) throw new Error("请输入用户名和密码");
      updateState({ authStatus: "authenticating", globalError: null });
      try {
        const { user } = await api.login(cleanUsername, password);
        updateState({ authStatus: "authenticated", user, globalError: null });
        await onAuthenticated?.(user);
        return user;
      } catch (error) {
        updateState({ authStatus: "anonymous", user: null });
        onError?.(error);
        throw error;
      }
    }

    async function logout() {
      updateState({ authStatus: "checking" });
      try {
        await api.logout();
      } finally {
        setAnonymous();
      }
    }

    return { login, logout, restore, setAnonymous };
  }

  return { createAuthManager };
});
