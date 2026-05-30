const state = {
  gpuNodes: [],
  requests: [],
  sandboxes: [],
  rotations: [],
  evaluations: [],
  knowledge: [],
  gpuMonitor: { source: "loading" },
};

const els = {
  roleSelect: document.querySelector("#roleSelect"),
  roleHint: document.querySelector("#roleHint"),
  metricGpuUsage: document.querySelector("#metricGpuUsage"),
  metricContainers: document.querySelector("#metricContainers"),
  metricRisks: document.querySelector("#metricRisks"),
  metricQueue: document.querySelector("#metricQueue"),
  clusterStatus: document.querySelector("#clusterStatus"),
  gpuGrid: document.querySelector("#gpuGrid"),
  requestQueue: document.querySelector("#requestQueue"),
  sandboxTable: document.querySelector("#sandboxTable"),
  rotationList: document.querySelector("#rotationList"),
  evaluationStudent: document.querySelector("#evaluationStudent"),
  evaluationSummary: document.querySelector("#evaluationSummary"),
  knowledgeGraph: document.querySelector("#knowledgeGraph"),
  knowledgeList: document.querySelector("#knowledgeList"),
  toast: document.querySelector("#toast"),
};

const modelBaseHours = {
  segmentation: 0.018,
  detection: 0.012,
  llm: 0.026,
  classification: 0.006,
};

const roleHints = {
  mentor: "导师视角关注进度风险、评分和知识沉淀。",
  student: "轮转生视角关注算力申请、训练预估和任务推进。",
  admin: "管理员视角关注节点资源、端口分配和沙箱生命周期。",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function priorityScore(request) {
  const urgencyWeight = Number(request.urgency) * 18;
  const releaseDiscipline = Math.min(20, Math.round(request.credit / 5));
  const gpuPenalty = Number(request.gpus) * 5;
  const durationPenalty = Math.min(20, Math.round(Number(request.hours) / 8));
  return urgencyWeight + releaseDiscipline - gpuPenalty - durationPenalty;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `请求失败：${response.status}`);
  }
  return data;
}

async function loadState() {
  const data = await apiRequest("/api/state");
  Object.assign(state, data);
  renderAll();
}

async function mutate(path, options = {}) {
  const data = await apiRequest(path, options);
  Object.assign(state, data);
  renderAll();
  return data;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}

function getNode(nodeId) {
  return state.gpuNodes.find((node) => node.id === nodeId);
}

function getNodeName(nodeId) {
  return getNode(nodeId)?.name ?? "未分配";
}

function renderRoleHint() {
  els.roleHint.textContent = roleHints[els.roleSelect.value] ?? roleHints.mentor;
}

function renderMetrics() {
  const totalGpu = state.gpuNodes.reduce((sum, node) => sum + Number(node.totalGpu), 0);
  const usedGpu = state.gpuNodes.reduce((sum, node) => sum + Number(node.usedGpu), 0);
  const risks = state.rotations.filter((rotation) => rotation.gpuHours > 60 && rotation.lastUpdateDays >= 5).length;
  const waiting = state.requests.filter((request) => request.status === "waiting").length;

  els.metricGpuUsage.textContent = `${pct(usedGpu, totalGpu)}%`;
  els.metricContainers.textContent = String(state.sandboxes.filter((box) => box.status === "running").length);
  els.metricRisks.textContent = String(risks);
  els.metricQueue.textContent = String(waiting);

  const hotNodes = state.gpuNodes.filter((node) => pct(node.usedGpu, node.totalGpu) >= 90).length;
  const source = state.gpuMonitor?.source === "nvidia-smi" ? "真实 GPU" : "种子数据";
  els.clusterStatus.textContent = hotNodes ? `${hotNodes} 个节点高负载 · ${source}` : `运行正常 · ${source}`;
  els.clusterStatus.className = hotNodes ? "status-pill amber" : "status-pill";
}

function renderGpuGrid() {
  if (!state.gpuNodes.length) {
    els.gpuGrid.innerHTML = `<article class="gpu-card"><p>暂无 GPU 节点数据，请确认后端服务已启动。</p></article>`;
    return;
  }

  els.gpuGrid.innerHTML = state.gpuNodes
    .map((node) => {
      const gpuPct = pct(node.usedGpu, node.totalGpu);
      const memPct = pct(node.memoryUsed, node.memoryTotal);
      const chipClass = gpuPct >= 90 ? "chip red" : gpuPct >= 70 ? "chip amber" : "chip";
      const ports = Array.isArray(node.ports) ? node.ports : [];
      return `
        <article class="gpu-card">
          <header>
            <div>
              <h3>${escapeHtml(node.name)}</h3>
              <p>${escapeHtml(node.gpu)} · ${escapeHtml(node.mount)}</p>
            </div>
            <span class="${chipClass}">${Math.max(0, node.totalGpu - node.usedGpu)} GPU 空闲</span>
          </header>
          <div class="bar-stack">
            <div class="bar-row">
              <label><span>GPU 占用</span><strong>${gpuPct}%</strong></label>
              <div class="bar"><span class="${gpuPct >= 90 ? "hot" : ""}" style="width:${gpuPct}%"></span></div>
            </div>
            <div class="bar-row">
              <label><span>显存占用</span><strong>${node.memoryUsed}/${node.memoryTotal} GB</strong></label>
              <div class="bar"><span class="${memPct >= 90 ? "hot" : ""}" style="width:${memPct}%"></span></div>
            </div>
          </div>
          <div class="port-row">
            ${ports.map((port) => `<span>${port}</span>`).join("") || "<span>无空闲端口</span>"}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRequests() {
  const queue = [...state.requests]
    .filter((request) => request.status === "waiting")
    .sort((a, b) => priorityScore(b) - priorityScore(a));

  if (!queue.length) {
    els.requestQueue.innerHTML = `<div class="queue-item"><p>当前没有待分配申请。</p></div>`;
    return;
  }

  els.requestQueue.innerHTML = queue
    .map((request) => {
      const score = priorityScore(request);
      return `
        <article class="queue-item">
          <header>
            <div>
              <h3>${escapeHtml(request.student)} · ${escapeHtml(request.topic)}</h3>
              <p>${escapeHtml(request.createdAt)} 提交 · ${escapeHtml(request.image)}</p>
            </div>
            <span class="chip">${score} 分</span>
          </header>
          <div class="queue-meta">
            <span>GPU<strong>${request.gpus}</strong></span>
            <span>预计时长<strong>${request.hours}h</strong></span>
            <span>信用<strong>${request.credit}</strong></span>
            <span>紧急度<strong>${request.urgency}</strong></span>
          </div>
          <div class="queue-actions">
            <button class="small-button" type="button" data-action="approve" data-id="${request.id}">批准分配</button>
            <button class="small-button danger" type="button" data-action="reject" data-id="${request.id}">驳回</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSandboxes() {
  if (!state.sandboxes.length) {
    els.sandboxTable.innerHTML = `<tr><td colspan="9">暂无运行中的沙箱记录。</td></tr>`;
    return;
  }

  els.sandboxTable.innerHTML = state.sandboxes
    .map((box) => {
      const statusClass = box.status === "running" ? "chip" : "chip amber";
      return `
        <tr>
          <td>${escapeHtml(box.id)}</td>
          <td>${escapeHtml(box.student)}</td>
          <td>${escapeHtml(getNodeName(box.nodeId))}</td>
          <td>${box.gpus}</td>
          <td>${box.port}</td>
          <td>${escapeHtml(box.image)}</td>
          <td>${box.snapshots}</td>
          <td><span class="${statusClass}">${box.status === "running" ? "运行中" : "已暂停"}</span></td>
          <td>
            <div class="sandbox-actions">
              <button class="small-button" type="button" data-action="snapshot" data-id="${escapeHtml(box.id)}">快照</button>
              <button class="small-button" type="button" data-action="toggle" data-id="${escapeHtml(box.id)}">
                ${box.status === "running" ? "暂停" : "恢复"}
              </button>
              <button class="small-button danger" type="button" data-action="release" data-id="${escapeHtml(box.id)}">释放</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderRotations() {
  els.rotationList.innerHTML = state.rotations
    .map((rotation) => {
      const avgProgress = Math.round(
        rotation.stages.reduce((sum, stage) => sum + Number(stage.progress), 0) / rotation.stages.length,
      );
      const risky = rotation.gpuHours > 60 && rotation.lastUpdateDays >= 5;
      const stageRows = rotation.stages
        .map(
          (stage) => `
            <div class="gantt-row">
              <span>${escapeHtml(stage.name)}</span>
              <div class="timeline"><i class="${stage.progress ? "" : "pending"}" style="width:${stage.progress}%"></i></div>
              <span>${stage.progress}%</span>
            </div>
          `,
        )
        .join("");
      return `
        <article class="rotation-card">
          <header>
            <div>
              <h3>${escapeHtml(rotation.student)} · ${escapeHtml(rotation.topic)}</h3>
              <p>GPU ${rotation.gpuHours} 小时 · ${rotation.lastUpdateDays} 天未更新 · 总进度 ${avgProgress}%</p>
            </div>
            <span class="${risky ? "chip amber" : "chip"}">${risky ? "触发提醒" : "进度正常"}</span>
          </header>
          <div class="gantt">${stageRows}</div>
          <div class="rotation-actions">
            <button class="small-button" type="button" data-action="progress" data-id="${rotation.id}">推进节点</button>
            <button class="small-button" type="button" data-action="remind" data-id="${rotation.id}">发送提醒</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEvaluations() {
  const current = els.evaluationStudent.value;
  const students = state.rotations.map((rotation) => rotation.student);
  els.evaluationStudent.innerHTML = students
    .map((student) => `<option value="${escapeHtml(student)}">${escapeHtml(student)}</option>`)
    .join("");
  if (students.includes(current)) {
    els.evaluationStudent.value = current;
  }

  els.evaluationSummary.innerHTML = state.evaluations
    .map(
      (item) => `
        <div class="evaluation-item">
          <strong>${escapeHtml(item.student)} · 综合 ${item.score}</strong>
          <div class="score-line"><span>代码提交</span><span>${item.code}</span></div>
          <div class="score-line"><span>算力效率</span><span>${item.efficiency}</span></div>
          <div class="score-line"><span>按期完成</span><span>${item.delivery}</span></div>
        </div>
      `,
    )
    .join("");
}

function renderKnowledge() {
  const filter = document.querySelector("#knowledgeFilter").value;
  const records = state.knowledge.filter((item) => filter === "all" || item.topic === filter);

  els.knowledgeList.innerHTML = records
    .map(
      (item) => `
        <article class="knowledge-item">
          <header>
            <div>
              <h3>${escapeHtml(item.topic)}</h3>
              <p>${escapeHtml(item.owner)} 接续 ${escapeHtml(item.ancestor)}</p>
            </div>
            <span class="chip">${escapeHtml(item.repo.split("/").slice(-1)[0])}</span>
          </header>
          <p><strong>问题：</strong>${escapeHtml(item.issue)}</p>
          <p><strong>方案：</strong>${escapeHtml(item.solution)}</p>
          <p><strong>代码：</strong>${escapeHtml(item.repo)}</p>
        </article>
      `,
    )
    .join("");

  renderKnowledgeGraph(records);
}

function renderKnowledgeGraph(records) {
  const center = { x: 360, y: 170, label: "实验室资产", type: "topic" };
  const nodes = [center];
  const links = [];

  records.forEach((item, index) => {
    const baseY = 76 + index * 96;
    const topic = { x: 178, y: baseY, label: item.topic, type: "topic" };
    const owner = { x: 360, y: baseY + 34, label: item.owner, type: "student" };
    const issue = { x: 548, y: baseY, label: "报错经验", type: "issue" };
    const code = { x: 548, y: baseY + 64, label: "代码分支", type: "code" };
    nodes.push(topic, owner, issue, code);
    links.push([center, topic], [topic, owner], [owner, issue], [owner, code]);
  });

  const linkMarkup = links
    .map(
      ([from, to]) =>
        `<line class="graph-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`,
    )
    .join("");
  const nodeMarkup = nodes
    .map(
      (node) => `
        <g>
          <circle class="graph-node ${node.type}" cx="${node.x}" cy="${node.y}" r="34"></circle>
          <text class="graph-label" x="${node.x}" y="${node.y + 5}">${escapeHtml(node.label)}</text>
        </g>
      `,
    )
    .join("");

  els.knowledgeGraph.innerHTML = `${linkMarkup}${nodeMarkup}`;
}

function estimateHours() {
  const modelType = document.querySelector("#modelType").value;
  const datasetSize = Number(document.querySelector("#datasetSize").value);
  const epochCount = Number(document.querySelector("#epochCount").value);
  const base = modelBaseHours[modelType] ?? modelBaseHours.classification;
  const hours = Math.max(1, Math.round(datasetSize * epochCount * base));
  document.querySelector("#predictedHours").textContent = `${hours} 小时`;
  document.querySelector("#predictionHint").textContent =
    hours > 48 ? "建议拆分阶段并设置释放提醒" : "可进入常规申请队列";
}

async function approveRequest(requestId) {
  await mutate(`/api/requests/${requestId}/approve`, { method: "POST" });
  showToast("申请已批准并写入数据库。");
}

async function rejectRequest(requestId) {
  await mutate(`/api/requests/${requestId}/reject`, { method: "POST" });
  showToast("申请已驳回。");
}

function autoSchedule() {
  const queue = [...state.requests]
    .filter((request) => request.status === "waiting")
    .sort((a, b) => priorityScore(b) - priorityScore(a));

  if (!queue.length) {
    showToast("队列为空。");
    return;
  }

  approveRequest(queue[0].id).catch((error) => showToast(error.message));
}

async function releaseSandbox(boxId) {
  await mutate(`/api/sandboxes/${encodeURIComponent(boxId)}`, { method: "DELETE" });
  showToast("沙箱资源已释放并更新数据库。");
}

async function toggleSandbox(boxId) {
  await mutate(`/api/sandboxes/${encodeURIComponent(boxId)}/toggle`, { method: "POST" });
  showToast("沙箱状态已更新。");
}

async function snapshotSandbox(boxId) {
  await mutate(`/api/sandboxes/${encodeURIComponent(boxId)}/snapshot`, { method: "POST" });
  showToast("环境快照版本已更新。");
}

async function progressRotation(rotationId) {
  await mutate(`/api/rotations/${rotationId}/progress`, { method: "POST" });
  showToast("轮转节点进度已写入数据库。");
}

async function remindRotation(rotationId) {
  await mutate(`/api/rotations/${rotationId}/remind`, { method: "POST" });
  showToast("进度提醒已记录。");
}

async function saveEvaluation(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const code = Number(formData.get("code"));
  const efficiency = Number(formData.get("efficiency"));
  const delivery = Number(formData.get("delivery"));
  const score = Math.round(code * 0.32 + efficiency * 0.34 + delivery * 0.34);

  await mutate("/api/evaluations", {
    method: "POST",
    body: JSON.stringify({
      student: formData.get("student"),
      score,
      code,
      efficiency,
      delivery,
    }),
  });
  showToast("导师评分已保存到数据库。");
}

async function submitRequest(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const student = formData.get("student").trim();
  const topic = formData.get("topic").trim();
  const dataset = formData.get("dataset").trim();

  if (!student || !topic || !dataset) {
    showToast("请补全学生、研究方向和数据集挂载路径。");
    return;
  }

  await mutate("/api/requests", {
    method: "POST",
    body: JSON.stringify({
      student,
      topic,
      gpus: Number(formData.get("gpus")),
      hours: Number(formData.get("hours")),
      urgency: Number(formData.get("urgency")),
      image: formData.get("image"),
      dataset,
    }),
  });
  showToast("算力申请已保存到数据库。");
  event.currentTarget.reset();
}

function applySearch() {
  const term = document.querySelector("#globalSearch").value.trim().toLowerCase();
  document.querySelectorAll(".queue-item, .rotation-card, .knowledge-item").forEach((card) => {
    const matched = !term || card.textContent.toLowerCase().includes(term);
    card.style.display = matched ? "" : "none";
  });
}

async function refreshResources() {
  await loadState();
  const source = state.gpuMonitor?.source === "nvidia-smi" ? "真实 nvidia-smi" : "数据库种子数据";
  showToast(`资源状态已刷新：${source}。`);
}

function bindEvents() {
  document.querySelector("#requestForm").addEventListener("submit", (event) => {
    submitRequest(event).catch((error) => showToast(error.message));
  });
  document.querySelector("#evaluationForm").addEventListener("submit", (event) => {
    saveEvaluation(event).catch((error) => showToast(error.message));
  });
  document.querySelector("#autoScheduleBtn").addEventListener("click", autoSchedule);
  document.querySelector("#refreshBtn").addEventListener("click", () => {
    refreshResources().catch((error) => showToast(error.message));
  });
  els.roleSelect.addEventListener("change", renderRoleHint);
  document.querySelector("#knowledgeFilter").addEventListener("change", renderKnowledge);
  document.querySelector("#globalSearch").addEventListener("input", applySearch);
  ["#modelType", "#datasetSize", "#epochCount"].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", estimateHours);
  });

  els.requestQueue.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === "approve") approveRequest(id).catch((error) => showToast(error.message));
    if (button.dataset.action === "reject") rejectRequest(id).catch((error) => showToast(error.message));
  });

  els.sandboxTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "snapshot") snapshotSandbox(button.dataset.id).catch((error) => showToast(error.message));
    if (button.dataset.action === "toggle") toggleSandbox(button.dataset.id).catch((error) => showToast(error.message));
    if (button.dataset.action === "release") releaseSandbox(button.dataset.id).catch((error) => showToast(error.message));
  });

  els.rotationList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === "progress") progressRotation(id).catch((error) => showToast(error.message));
    if (button.dataset.action === "remind") remindRotation(id).catch((error) => showToast(error.message));
  });
}

function renderAll() {
  renderRoleHint();
  renderMetrics();
  renderGpuGrid();
  renderRequests();
  renderSandboxes();
  renderRotations();
  renderEvaluations();
  renderKnowledge();
  estimateHours();
  applySearch();
}

bindEvents();
loadState().catch((error) => {
  showToast(`后端连接失败：${error.message}。请运行 npm start 后访问 http://localhost:3000`);
});
