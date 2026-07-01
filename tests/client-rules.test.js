const assert = require("node:assert/strict");

const {
  escapeHtml,
  estimateTrainingHours,
  isRotationRisk,
  pct,
  priorityScore,
} = require("../src/client/rules");

assert.equal(pct(3, 4), 75);
assert.equal(pct(5, 0), 0);

assert.equal(
  priorityScore({
    urgency: 5,
    credit: 92,
    gpus: 1,
    hours: 9,
  }),
  103,
);

assert.equal(estimateTrainingHours("segmentation", 180, 80), 259);
assert.equal(estimateTrainingHours("unknown", 10, 1), 1);

assert.equal(isRotationRisk({ gpuHours: 61, lastUpdateDays: 5 }), true);
assert.equal(isRotationRisk({ gpuHours: 60, lastUpdateDays: 5 }), false);

assert.equal(escapeHtml(`<script>"x"&'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#039;&lt;/script&gt;");

console.log("Client rule tests passed");
