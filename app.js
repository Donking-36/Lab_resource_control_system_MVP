// MVP demo data. Replace this state with backend APIs before production use.
const state = {
  gpuNodes: [
    {
      id: "node-a100-01",
      name: "A100-01",
      gpu: "4 x A100 80G",
      totalGpu: 4,
      usedGpu: 3,
      memoryTotal: 320,
      memoryUsed: 218,
      mount: "/mnt/raid0",
      ports: [8801, 8802, 8804],
    },
    {
      id: "node-4090-02",
      name: "RTX4090-02",
      gpu: "4 x RTX 4090 24G",
      totalGpu: 4,
      usedGpu: 1,
      memoryTotal: 96,
      memoryUsed: 24,
      mount: "/data/lab",
      ports: [8810, 8812, 8813, 8814],
    },
    {
      id: "node-3090-03",
      name: "RTX3090-03",
      gpu: "2 x RTX 3090 24G",
      totalGpu: 2,
      usedGpu: 2,
      memoryTotal: 48,
      memoryUsed: 44,
      mount: "/data/archive",
      ports: [8820],
    },
    {
      id: "node-l40-04",
      name: "L40S-04",
      gpu: "2 x L40S 48G",
      totalGpu: 2,
      usedGpu: 0,
      memoryTotal: 96,
      memoryUsed: 8,
      mount: "/datasets",
      ports: [8830, 8831, 8832],
    },
  ],
  requests: [
    {
      id: 101,
      student: "赵明",
      topic: "目标检测",
      gpus: 1,
      hours: 9,
      urgency: 4,
      image: "pytorch-2.3-cuda12",
      dataset: "/datasets/detection",
      credit: 92,
      status: "waiting",
      createdAt: "09:20",
    },
    {
      id: 102,
      student: "陈曦",
      topic: "医学图像分割",
      gpus: 2,
      hours: 22,
      urgency: 5,
      image: "pytorch-1.13-cuda11",
      dataset: "/datasets/medical-seg",
      credit: 84,
      status: "waiting",
      createdAt: "10:05",
    },
  ],
  sandboxes: [
    {
      id: "lab-rot-chenxi",
      student: "陈曦",
      nodeId: "node-a100-01",
      gpus: 2,
      port: 8803,
      image: "pytorch-1.13-cuda11",
      dataset: "/datasets/medical-seg",
      status: "running",
      snapshots: 1,
    },
    {
      id: "lab-rot-wuyang",
      student: "吴洋",
      nodeId: "node-4090-02",
      gpus: 1,
      port: 8811,
      image: "pytorch-2.3-cuda12",
      dataset: "/datasets/detection",
      status: "running",
      snapshots: 0,
    },
  ],
  rotations: [
    {
      student: "陈曦",
      topic: "医学图像分割",
      gpuHours: 86,
      lastUpdateDays: 6,
      stages: [
        { name: "文献调研", progress: 100 },
        { name: "复现 Baseline", progress: 90 },
        { name: "改进网络", progress: 45 },
        { name: "消融实验", progress: 15 },
        { name: "论文撰写", progress: 0 },
      ],
    },
    {
      student: "赵明",
      topic: "目标检测",
      gpuHours: 31,
      lastUpdateDays: 2,
      stages: [
        { name: "文献调研", progress: 100 },
        { name: "复现 Baseline", progress: 80 },
        { name: "数据清洗", progress: 65 },
        { name: "模型调参", progress: 35 },
        { name: "总结汇报", progress: 0 },
      ],
    },
    {
      student: "林可",
      topic: "小模型微调",
      gpuHours: 12,
      lastUpdateDays: 1,
      stages: [
        { name: "需求定义", progress: 100 },
        { name: "样本构造", progress: 60 },
        { name: "LoRA 训练", progress: 20 },
        { name: "评测集", progress: 0 },
        { name: "交接文档", progress: 0 },
      ],
    },
  ],
  evaluations: [
    { student: "陈曦", score: 82, code: 78, efficiency: 80, delivery: 88 },
    { student: "赵明", score: 86, code: 84, efficiency: 91, delivery: 82 },
  ],
  knowledge: [
    {
      id: "k-1",
      topic: "医学图像分割",
      owner: "陈曦",
      ancestor: "2024 级师姐 王宁",
      issue: "nnUNet 多卡训练显存碎片",
      solution: "固定 batch size 后开启梯度累积，容器镜像锁定 CUDA 11.8。",
      repo: "github.com/lab/medical-seg/tree/nnunet-v2",
    },
    {
      id: "k-2",
      topic: "目标检测",
      owner: "赵明",
      ancestor: "2023 级师兄 孙航",
      issue: "YOLO 数据增强导致小目标召回下降",
      solution: "关闭过强 Mosaic，补充小目标裁剪样本并重训最后 40 epoch。",
      repo: "github.com/lab/detection/tree/yolo-small-object",
    },
    {
      id: "k-3",
      topic: "小模型微调",
      owner: "林可",
      ancestor: "2024 级师兄 刘澈",
      issue: "LoRA 微调后中文术语幻觉",
      solution: "增加术语表检索增强，训练集按任务类别分层采样。",
      repo: "github.com/lab/tiny-llm/tree/lora-rag",
    },
  ],
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
  return String(value)
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
  const gpuPenalty = request.gpus * 5;
  const durationPenalty = Math.min(20, Math.round(request.hours / 8));
  return urgencyWeight + releaseDiscipline - gpuPenalty - durationPenalty;
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
  const totalGpu = state.gpuNodes.reduce((sum, node) => sum + node.totalGpu, 0);
  const usedGpu = state.gpuNodes.reduce((sum, node) => sum + node.usedGpu, 0);
  const risks = state.rotations.filter((rotation) => rotation.gpuHours > 60 && rotation.lastUpdateDays >= 5).length;
  const waiting = state.requests.filter((request) => request.status === "waiting").length;

  els.metricGpuUsage.textContent = `${pct(usedGpu, totalGpu)}%`;
  els.metricContainers.textContent = String(state.sandboxes.filter((box) => box.status === "running").length);
  els.metricRisks.textContent = String(risks);
  els.metricQueue.textContent = String(waiting);

  const hotNodes = state.gpuNodes.filter((node) => pct(node.usedGpu, node.totalGpu) >= 90).length;
  els.clusterStatus.textContent = hotNodes ? `${hotNodes} 个节点高负载` : "运行正常";
  els.clusterStatus.className = hotNodes ? "status-pill amber" : "status-pill";
}

function renderGpuGrid() {
  els.gpuGrid.innerHTML = state.gpuNodes
    .map((node) => {
      const gpuPct = pct(node.usedGpu, node.totalGpu);
      const memPct = pct(node.memoryUsed, node.memoryTotal);
      const chipClass = gpuPct >= 90 ? "chip red" : gpuPct >= 70 ? "chip amber" : "chip";
      return `
        <article class="gpu-card">
          <header>
            <div>
              <h3>${node.name}</h3>
              <p>${node.gpu} · ${node.mount}</p>
            </div>
            <span class="${chipClass}">${node.totalGpu - node.usedGpu} GPU 空闲</span>
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
            ${node.ports.map((port) => `<span>${port}</span>`).join("") || "<span>无空闲端口</span>"}
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
      const student = escapeHtml(request.student);
      const topic = escapeHtml(request.topic);
      const createdAt = escapeHtml(request.createdAt);
      const image = escapeHtml(request.image);
      return `
        <article class="queue-item">
          <header>
            <div>
              <h3>${student} · ${topic}</h3>
              <p>${createdAt} 提交 · ${image}</p>
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
  els.sandboxTable.innerHTML = state.sandboxes
    .map((box) => {
      const statusClass = box.status === "running" ? "chip" : "chip amber";
      const boxId = escapeHtml(box.id);
      const student = escapeHtml(box.student);
      const nodeName = escapeHtml(getNodeName(box.nodeId));
      const image = escapeHtml(box.image);
      return `
        <tr>
          <td>${boxId}</td>
          <td>${student}</td>
          <td>${nodeName}</td>
          <td>${box.gpus}</td>
          <td>${box.port}</td>
          <td>${image}</td>
          <td>${box.snapshots}</td>
          <td><span class="${statusClass}">${box.status === "running" ? "运行中" : "已暂停"}</span></td>
          <td>
            <div class="sandbox-actions">
              <button class="small-button" type="button" data-action="snapshot" data-id="${boxId}">快照</button>
              <button class="small-button" type="button" data-action="toggle" data-id="${boxId}">
                ${box.status === "running" ? "暂停" : "恢复"}
              </button>
              <button class="small-button danger" type="button" data-action="release" data-id="${boxId}">释放</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderRotations() {
  els.rotationList.innerHTML = state.rotations
    .map((rotation, rotationIndex) => {
      const avgProgress = Math.round(
        rotation.stages.reduce((sum, stage) => sum + stage.progress, 0) / rotation.stages.length,
      );
      const risky = rotation.gpuHours > 60 && rotation.lastUpdateDays >= 5;
      const student = escapeHtml(rotation.student);
      const topic = escapeHtml(rotation.topic);
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
              <h3>${student} · ${topic}</h3>
              <p>GPU ${rotation.gpuHours} 小时 · ${rotation.lastUpdateDays} 天未更新 · 总进度 ${avgProgress}%</p>
            </div>
            <span class="${risky ? "chip amber" : "chip"}">${risky ? "触发提醒" : "进度正常"}</span>
          </header>
          <div class="gantt">${stageRows}</div>
          <div class="rotation-actions">
            <button class="small-button" type="button" data-action="progress" data-index="${rotationIndex}">推进节点</button>
            <button class="small-button" type="button" data-action="remind" data-index="${rotationIndex}">发送提醒</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEvaluations() {
  const students = state.rotations.map((rotation) => rotation.student);
  els.evaluationStudent.innerHTML = students
    .map((student) => `<option value="${escapeHtml(student)}">${escapeHtml(student)}</option>`)
    .join("");
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

function approveRequest(requestId) {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "waiting") return;

  const node = state.gpuNodes
    .filter((item) => item.totalGpu - item.usedGpu >= request.gpus && item.ports.length)
    .sort((a, b) => a.usedGpu / a.totalGpu - b.usedGpu / b.totalGpu)[0];

  if (!node) {
    showToast("当前没有满足条件的节点，申请保持排队。");
    return;
  }

  const port = node.ports.shift();
  node.usedGpu += request.gpus;
  node.memoryUsed = Math.min(node.memoryTotal, node.memoryUsed + request.gpus * 18);
  request.status = "allocated";

  state.sandboxes.push({
    id: `lab-rot-${request.id}`,
    student: request.student,
    nodeId: node.id,
    gpus: request.gpus,
    port,
    image: request.image,
    dataset: request.dataset,
    status: "running",
    snapshots: 0,
  });

  showToast(`${request.student} 已分配到 ${node.name}:${port}`);
  renderAll();
}

function rejectRequest(requestId) {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return;
  request.status = "rejected";
  showToast(`${request.student} 的申请已驳回。`);
  renderAll();
}

function autoSchedule() {
  const queue = [...state.requests]
    .filter((request) => request.status === "waiting")
    .sort((a, b) => priorityScore(b) - priorityScore(a));

  if (!queue.length) {
    showToast("队列为空。");
    return;
  }

  approveRequest(queue[0].id);
}

function releaseSandbox(boxId) {
  const index = state.sandboxes.findIndex((box) => box.id === boxId);
  if (index === -1) return;
  const box = state.sandboxes[index];
  const node = getNode(box.nodeId);
  if (node) {
    node.usedGpu = Math.max(0, node.usedGpu - box.gpus);
    node.memoryUsed = Math.max(0, node.memoryUsed - box.gpus * 18);
    node.ports.push(box.port);
    node.ports.sort((a, b) => a - b);
  }
  state.sandboxes.splice(index, 1);
  showToast(`${box.student} 的沙箱资源已释放。`);
  renderAll();
}

function toggleSandbox(boxId) {
  const box = state.sandboxes.find((item) => item.id === boxId);
  if (!box) return;
  box.status = box.status === "running" ? "paused" : "running";
  showToast(`${box.student} 的沙箱已${box.status === "running" ? "恢复" : "暂停"}。`);
  renderAll();
}

function snapshotSandbox(boxId) {
  const box = state.sandboxes.find((item) => item.id === boxId);
  if (!box) return;
  box.snapshots += 1;
  showToast(`${box.student} 的环境快照已生成，第 ${box.snapshots} 版。`);
  renderAll();
}

function progressRotation(index) {
  const rotation = state.rotations[index];
  if (!rotation) return;
  const stage = rotation.stages.find((item) => item.progress < 100);
  if (!stage) {
    showToast(`${rotation.student} 的轮转任务已完成。`);
    return;
  }
  stage.progress = Math.min(100, stage.progress + 15);
  rotation.lastUpdateDays = 0;
  showToast(`${rotation.student} 的 ${stage.name} 已更新到 ${stage.progress}%。`);
  renderAll();
}

function remindRotation(index) {
  const rotation = state.rotations[index];
  if (!rotation) return;
  rotation.lastUpdateDays = Math.max(0, rotation.lastUpdateDays - 2);
  showToast(`已向 ${rotation.student} 发送进度提醒。`);
  renderAll();
}

function saveEvaluation(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const student = formData.get("student");
  const code = Number(formData.get("code"));
  const efficiency = Number(formData.get("efficiency"));
  const delivery = Number(formData.get("delivery"));
  const score = Math.round(code * 0.32 + efficiency * 0.34 + delivery * 0.34);
  const existing = state.evaluations.find((item) => item.student === student);

  if (existing) {
    Object.assign(existing, { score, code, efficiency, delivery });
  } else {
    state.evaluations.push({ student, score, code, efficiency, delivery });
  }

  showToast(`${student} 的导师评分已保存。`);
  renderEvaluations();
}

function submitRequest(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const student = formData.get("student").trim();
  const topic = formData.get("topic").trim();
  const dataset = formData.get("dataset").trim();

  if (!student || !topic || !dataset) {
    showToast("请补全学生、研究方向和数据集挂载路径。");
    return;
  }

  const request = {
    id: Date.now(),
    student,
    topic,
    gpus: Number(formData.get("gpus")),
    hours: Number(formData.get("hours")),
    urgency: Number(formData.get("urgency")),
    image: formData.get("image"),
    dataset,
    credit: 80 + Math.floor(Math.random() * 18),
    status: "waiting",
    createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  };

  state.requests.push(request);
  showToast(`${request.student} 的算力申请已进入队列。`);
  renderAll();
}

function applySearch() {
  const term = document.querySelector("#globalSearch").value.trim().toLowerCase();
  document.querySelectorAll(".queue-item, .rotation-card, .knowledge-item").forEach((card) => {
    const matched = !term || card.textContent.toLowerCase().includes(term);
    card.style.display = matched ? "" : "none";
  });
}

function jitterResources() {
  state.gpuNodes.forEach((node) => {
    const delta = Math.floor(Math.random() * 3) - 1;
    node.memoryUsed = Math.max(0, Math.min(node.memoryTotal, node.memoryUsed + delta * 4));
  });
  showToast("模拟资源状态已刷新。");
  renderAll();
}

function bindEvents() {
  document.querySelector("#requestForm").addEventListener("submit", submitRequest);
  document.querySelector("#evaluationForm").addEventListener("submit", saveEvaluation);
  document.querySelector("#autoScheduleBtn").addEventListener("click", autoSchedule);
  document.querySelector("#refreshBtn").addEventListener("click", jitterResources);
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
    if (button.dataset.action === "approve") approveRequest(id);
    if (button.dataset.action === "reject") rejectRequest(id);
  });

  els.sandboxTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "snapshot") snapshotSandbox(button.dataset.id);
    if (button.dataset.action === "toggle") toggleSandbox(button.dataset.id);
    if (button.dataset.action === "release") releaseSandbox(button.dataset.id);
  });

  els.rotationList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "progress") progressRotation(index);
    if (button.dataset.action === "remind") remindRotation(index);
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
renderAll();
