const assert = require("node:assert/strict");
const path = require("node:path");

const renderPath = path.resolve(__dirname, "../src/client/render.js");

function loadRenderer(parts) {
  delete require.cache[renderPath];
  globalThis.LabRenderParts = parts;
  return require(renderPath);
}

function createPartFactory(methods, calls) {
  return () =>
    Object.fromEntries(
      methods.map((method) => [
        method,
        () => {
          calls.push(method);
        },
      ]),
    );
}

try {
  {
    const renderApi = loadRenderer({});
    assert.throws(
      () => renderApi.createRenderer({ state: {}, els: {}, documentRef: {}, rules: {}, permissions: {} }),
      /缺少前端渲染模块：auth, metrics, gpu, requests, sandboxes, rotations, evaluations, knowledge, intelligence, algorithmReport, controls/,
    );
  }

  {
    const calls = [];
    const renderApi = loadRenderer({
      auth: {
        createAuthRenderer: createPartFactory(["renderAuth", "renderGlobalError", "renderPending"], calls),
      },
      metrics: {
        createMetricsRenderer: createPartFactory(["renderRoleHint", "renderMetrics"], calls),
      },
      gpu: {
        createGpuRenderer: createPartFactory(["renderGpuGrid"], calls),
      },
      requests: {
        createRequestRenderer: createPartFactory(["renderRequests"], calls),
      },
      sandboxes: {
        createSandboxRenderer: createPartFactory(["renderSandboxes"], calls),
      },
      rotations: {
        createRotationRenderer: createPartFactory(["renderRotations"], calls),
      },
      evaluations: {
        createEvaluationRenderer: createPartFactory(["renderEvaluations"], calls),
      },
      knowledge: {
        createKnowledgeRenderer: createPartFactory(["renderKnowledge"], calls),
      },
      intelligence: {
        createIntelligenceRenderer: createPartFactory(["renderIntelligence"], calls),
      },
      algorithmReport: {
        createAlgorithmReportRenderer: createPartFactory(["renderAlgorithmReport"], calls),
      },
      controls: {
        createControlRenderer: createPartFactory(["estimateHours", "applySearch"], calls),
      },
    });

    const renderer = renderApi.createRenderer({ state: {}, els: {}, documentRef: {}, rules: {}, permissions: {} });
    renderer.renderAll();

    assert.deepEqual(calls, [
      "renderAuth",
      "renderGlobalError",
      "renderRoleHint",
      "renderMetrics",
      "renderGpuGrid",
      "renderRequests",
      "renderSandboxes",
      "renderRotations",
      "renderEvaluations",
      "renderKnowledge",
      "renderIntelligence",
      "renderAlgorithmReport",
      "estimateHours",
      "applySearch",
      "renderPending",
    ]);
  }

  console.log("Client render tests passed");
} finally {
  delete require.cache[renderPath];
  delete globalThis.LabRenderParts;
}
