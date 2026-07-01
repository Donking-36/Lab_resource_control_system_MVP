const { state, updateState } = window.LabState;
const { els } = window.LabDom;
const renderer = window.LabRender.createRenderer({
  state,
  els,
  documentRef: document,
  rules: window.LabClientRules,
});

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}

const handlers = window.LabEvents.createEventHandlers({
  state,
  els,
  documentRef: document,
  api: window.LabApi,
  updateState,
  renderer,
  showToast,
  rules: window.LabClientRules,
});

handlers.bindEvents();
handlers.loadState().catch((error) => {
  showToast(`后端连接失败：${error.message}。请运行 npm start 后访问 http://localhost:3000`);
});
