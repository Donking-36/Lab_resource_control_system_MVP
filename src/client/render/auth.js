(function initAuthRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.auth = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createAuthPart() {
  function createAuthRenderer({ state, els, documentRef, permissions }) {
    function renderAuth() {
      const checking = state.authStatus === "checking" || state.authStatus === "authenticating";
      const authenticated = state.authStatus === "authenticated" && Boolean(state.user);
      if (els.authLoading) els.authLoading.hidden = !checking;
      if (els.loginView) els.loginView.hidden = checking || authenticated;
      if (els.appShell) els.appShell.hidden = !authenticated;
      if (els.currentUserName) els.currentUserName.textContent = state.user?.displayName || "未登录";
      if (els.currentUserRole) els.currentUserRole.textContent = permissions.roleLabel(state.user?.role);
      if (els.logoutBtn) els.logoutBtn.hidden = !authenticated;

      documentRef.querySelectorAll("[data-capability]").forEach((element) => {
        element.hidden = !permissions.can(state.user, element.dataset.capability);
      });

      const studentInput = documentRef.querySelector('#requestForm [name="student"]');
      if (studentInput && state.user?.role === "student") {
        studentInput.value = state.user.displayName;
        studentInput.readOnly = true;
      } else if (studentInput) {
        studentInput.readOnly = false;
      }
    }

    function renderGlobalError() {
      const error = state.globalError;
      if (!els.globalError) return;
      els.globalError.hidden = !error;
      if (!error) return;
      const suffix = [error.code, error.requestId].filter(Boolean).join(" · ");
      els.globalErrorMessage.textContent = error.message || "请求失败";
      els.globalErrorMeta.textContent = suffix;
    }

    function renderPending() {
      documentRef.querySelectorAll("[data-pending-key]").forEach((button) => {
        const pending = Boolean(state.pendingActions?.[button.dataset.pendingKey]);
        button.disabled = pending;
        button.setAttribute("aria-busy", String(pending));
      });
    }

    return { renderAuth, renderGlobalError, renderPending };
  }
  return { createAuthRenderer };
});
