const assert = require("node:assert/strict");
const path = require("node:path");
const { escapeHtml } = require("../src/client/rules");

const modulePath = path.resolve(__dirname, "../src/client/render/algorithmReport.js");
globalThis.LabRenderParts = {};
require(modulePath);

const els = {
  algorithmReportMeta: { textContent: "" },
  algorithmReportTable: { innerHTML: "" },
};
const state = {
  algorithmReport: {
    algorithmVersion: "xfs-v1",
    trials: 30,
    seed: 20240607,
    results: {
      fifo: { avgWaitHours: { mean: 2 }, p95WaitHours: { mean: 5 }, jainIndex: { mean: 0.7 }, gpuUtilization: { mean: 0.8 }, throughputPerHour: { mean: 3 }, starvationRate: { mean: 0.1 } },
      "xfs-v1": { avgWaitHours: { mean: 1 }, p95WaitHours: { mean: 3 }, jainIndex: { mean: 0.9 }, gpuUtilization: { mean: 0.92 }, throughputPerHour: { mean: 4 }, starvationRate: { mean: 0.02 } },
    },
  },
};

const renderer = globalThis.LabRenderParts.algorithmReport.createAlgorithmReportRenderer({ state, els, rules: { escapeHtml } });
renderer.renderAlgorithmReport();

assert.match(els.algorithmReportMeta.textContent, /xfs-v1 · 30 轮/);
assert.match(els.algorithmReportTable.innerHTML, /FIFO/);
assert.match(els.algorithmReportTable.innerHTML, /XFS-V1/);
assert.match(els.algorithmReportTable.innerHTML, /92\.0%/);
assert.match(els.algorithmReportTable.innerHTML, /algorithm-winner/);

delete require.cache[modulePath];
delete globalThis.LabRenderParts;
console.log("Client algorithm report tests passed");
