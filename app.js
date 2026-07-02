const { state, updateState } = window.LabState;
const { els } = window.LabDom;
const renderer = window.LabRender.createRenderer({
  state,
  els,
  documentRef: document,
  rules: window.LabClientRules,
  permissions: window.LabPermissions,
});

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}

function confirmAction(message) {
  if (!els.confirmDialog?.showModal) return Promise.resolve(window.confirm(message));
  els.confirmMessage.textContent = message;
  els.confirmDialog.returnValue = "cancel";
  els.confirmDialog.showModal();
  return new Promise((resolve) => {
    els.confirmDialog.addEventListener("close", () => resolve(els.confirmDialog.returnValue === "confirm"), { once: true });
  });
}

let authManager;
const handlers = window.LabEvents.createEventHandlers({
  state,
  els,
  documentRef: document,
  api: window.LabApi,
  updateState,
  renderer,
  showToast,
  rules: window.LabClientRules,
  confirmAction,
  onApiError(error) {
    if (error.status === 401 || error.code === "UNAUTHENTICATED") {
      authManager?.setAnonymous({ message: "登录已过期，请重新登录", code: error.code, requestId: error.requestId });
    }
  },
});

handlers.bindEvents();
authManager = window.LabAuth.createAuthManager({
  api: window.LabApi,
  updateState,
  async onAuthenticated() {
    renderer.renderAll();
    await Promise.all([handlers.loadState(), handlers.loadAlgorithmReport()]);
  },
  onAnonymous() {
    renderer.renderAll();
  },
  onError(error) {
    if (els.loginError) {
      els.loginError.textContent = `${error.message}${error.requestId ? ` · 请求 ${error.requestId}` : ""}`;
      els.loginError.hidden = false;
    }
  },
});

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  els.loginError.hidden = true;
  authManager
    .login({ username: form.get("username"), password: form.get("password") })
    .catch((error) => {
      els.loginError.textContent = error.message;
      els.loginError.hidden = false;
    });
});

els.logoutBtn.addEventListener("click", () => authManager.logout().catch((error) => showToast(error.message)));
els.retryBtn.addEventListener("click", () => {
  if (state.authStatus === "authenticated") {
    Promise.all([handlers.loadState(), handlers.loadAlgorithmReport()]).catch((error) => showToast(error.message));
  } else {
    authManager.restore();
  }
});

authManager.restore();
