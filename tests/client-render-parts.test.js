const assert = require("node:assert/strict");
const path = require("node:path");

const { escapeHtml, estimateTrainingHours, isRotationRisk, pct, priorityScore } = require("../src/client/rules");

function loadPart(name) {
  const filePath = path.resolve(__dirname, `../src/client/render/${name}.js`);
  delete require.cache[filePath];
  globalThis.LabRenderParts = {};
  require(filePath);
  return {
    part: globalThis.LabRenderParts[name],
    cleanup() {
      delete require.cache[filePath];
      delete globalThis.LabRenderParts;
    },
  };
}

try {
  {
    const { part, cleanup } = loadPart("metrics");
    const els = {
      roleSelect: { value: "student" },
      roleHint: { textContent: "" },
      metricGpuUsage: { textContent: "" },
      metricContainers: { textContent: "" },
      metricRisks: { textContent: "" },
      metricQueue: { textContent: "" },
      clusterStatus: { textContent: "", className: "" },
    };
    const renderer = part.createMetricsRenderer({
      state: {
        gpuNodes: [
          { totalGpu: 4, usedGpu: 2 },
          { totalGpu: 4, usedGpu: 4 },
        ],
        rotations: [
          { progress: 60, lastUpdateDays: 10, gpuHours: 130 },
          { progress: 90, lastUpdateDays: 1, gpuHours: 12 },
        ],
        requests: [
          { status: "waiting" },
          { status: "approved" },
          { status: "waiting" },
        ],
        sandboxes: [
          { status: "running" },
          { status: "paused" },
        ],
        gpuMonitor: { source: "nvidia-smi" },
      },
      els,
      rules: { isRotationRisk, pct },
    });

    renderer.renderRoleHint({
      mentor: "导师",
      student: "学生",
    });
    renderer.renderMetrics();

    assert.equal(els.roleHint.textContent, "学生");
    assert.equal(els.metricGpuUsage.textContent, "75%");
    assert.equal(els.metricContainers.textContent, "1");
    assert.equal(els.metricRisks.textContent, "1");
    assert.equal(els.metricQueue.textContent, "2");
    assert.equal(els.clusterStatus.textContent, "1 个节点高负载 · 真实 GPU");
    assert.equal(els.clusterStatus.className, "status-pill amber");

    cleanup();
  }

  {
    const { part, cleanup } = loadPart("requests");
    const els = {
      requestQueue: { innerHTML: "" },
    };
    const renderer = part.createRequestRenderer({
      state: {
        requests: [
          {
            id: 1,
            status: "waiting",
            student: "低优先级",
            topic: "基础实验",
            createdAt: "2026-06-01",
            image: "busybox-demo",
            gpus: 1,
            hours: 80,
            credit: 80,
            urgency: 1,
          },
          {
            id: 2,
            status: "waiting",
            student: "林<script>",
            topic: "医学 & AI",
            createdAt: "2026-06-02",
            image: "pytorch-2.3-cuda12",
            gpus: 1,
            hours: 8,
            credit: 95,
            urgency: 5,
          },
          {
            id: 3,
            status: "approved",
            student: "不应显示",
            topic: "已批准任务",
            createdAt: "2026-06-03",
            image: "busybox-demo",
            gpus: 1,
            hours: 1,
            credit: 100,
            urgency: 5,
          },
        ],
      },
      els,
      rules: { escapeHtml, priorityScore },
    });

    renderer.renderRequests();

    assert.ok(els.requestQueue.innerHTML.indexOf('data-id="2"') < els.requestQueue.innerHTML.indexOf('data-id="1"'));
    assert.ok(!els.requestQueue.innerHTML.includes('data-id="3"'));
    assert.ok(els.requestQueue.innerHTML.includes("林&lt;script&gt;"));
    assert.ok(els.requestQueue.innerHTML.includes("医学 &amp; AI"));
    assert.ok(!els.requestQueue.innerHTML.includes("林<script>"));

    cleanup();
  }

  {
    const { part, cleanup } = loadPart("requests");
    const els = {
      requestQueue: { innerHTML: "" },
    };
    const renderer = part.createRequestRenderer({
      state: { requests: [{ status: "approved" }] },
      els,
      rules: { escapeHtml, priorityScore },
    });

    renderer.renderRequests();

    assert.match(els.requestQueue.innerHTML, /当前没有待分配申请/);
    cleanup();
  }

  {
    const { part, cleanup } = loadPart("controls");
    const elements = {
      "#modelType": { value: "llm" },
      "#datasetSize": { value: "20" },
      "#epochCount": { value: "3" },
      "#predictedHours": { textContent: "" },
      "#predictionHint": { textContent: "" },
      "#globalSearch": { value: "医学" },
    };
    const cards = [
      { textContent: "医学图像分割", style: { display: "unchanged" } },
      { textContent: "强化学习", style: { display: "unchanged" } },
    ];
    const documentRef = {
      querySelector(selector) {
        return elements[selector];
      },
      querySelectorAll(selector) {
        assert.equal(selector, ".queue-item, .rotation-card, .knowledge-item");
        return cards;
      },
    };
    const renderer = part.createControlRenderer({
      documentRef,
      rules: { estimateTrainingHours },
    });

    renderer.estimateHours();
    renderer.applySearch();

    assert.equal(elements["#predictedHours"].textContent, "2 小时");
    assert.equal(elements["#predictionHint"].textContent, "可进入常规申请队列");
    assert.equal(cards[0].style.display, "");
    assert.equal(cards[1].style.display, "none");

    cleanup();
  }

  console.log("Client render part tests passed");
} finally {
  delete globalThis.LabRenderParts;
}
