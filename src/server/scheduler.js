const ALGORITHM_VERSION = "xfs-v1";

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function waitingMinutes(createdAt, now = new Date()) {
  const value = String(createdAt || "");
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return Math.max(0, Math.round((now.getTime() - parsed) / 60000));
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const created = Number(match[1]) * 60 + Number(match[2]);
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= created ? current - created : current + 1440 - created;
}

function rankGpuNodes(nodes, request) {
  return (nodes || [])
    .filter((node) => node.totalGpu - node.usedGpu >= request.gpus && Array.isArray(node.ports) && node.ports.length)
    .map((node) => {
      const freeGpu = node.totalGpu - node.usedGpu;
      const freeMemory = Math.max(0, node.memoryTotal - node.memoryUsed);
      const capacity = 45 * clamp(freeGpu / Math.max(1, node.totalGpu));
      const memory = 30 * clamp(freeMemory / Math.max(1, node.memoryTotal));
      const bestFit = 15 * (1 - clamp((freeGpu - request.gpus) / Math.max(1, node.totalGpu)));
      const trust = node.source === "nvidia-smi" ? 10 : 5;
      return {
        node,
        score: round(capacity + memory + bestFit + trust),
        components: { capacity: round(capacity), memory: round(memory), bestFit: round(bestFit), sourceTrust: trust },
      };
    })
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
}

function jainFairness(values) {
  if (!values.length || values.every((value) => value === 0)) return 1;
  const sum = values.reduce((total, value) => total + value, 0);
  const squares = values.reduce((total, value) => total + value ** 2, 0);
  return round((sum ** 2) / (values.length * squares), 3);
}

function buildSchedulingSnapshot({ requests = [], sandboxes = [], gpuNodes = [], now = new Date() }) {
  const waiting = requests.filter((request) => request.status === "waiting");
  const totalGpu = gpuNodes.reduce((sum, node) => sum + Number(node.totalGpu || 0), 0);
  const activeByStudent = new Map();
  sandboxes.forEach((box) => {
    activeByStudent.set(box.student, (activeByStudent.get(box.student) || 0) + Number(box.gpus || 0));
  });
  const students = [...new Set([...waiting.map((item) => item.student), ...activeByStudent.keys()])];
  const fairnessIndex = jainFairness(students.map((student) => activeByStudent.get(student) || 0));

  const decisions = waiting
    .map((request) => {
      const ageMinutes = waitingMinutes(request.createdAt, now);
      const gpuHours = Number(request.gpus) * Number(request.hours);
      const activeGpu = activeByStudent.get(request.student) || 0;
      const components = {
        urgency: round(35 * clamp(Number(request.urgency) / 5)),
        credit: round(20 * clamp(Number(request.credit) / 100)),
        aging: round(15 * clamp(ageMinutes / 720)),
        efficiency: round(15 * (1 - clamp(gpuHours / 1344))),
        fairness: round(15 * (1 - clamp(activeGpu / Math.max(1, totalGpu)))),
      };
      const rankedNodes = rankGpuNodes(gpuNodes, request);
      return {
        requestId: request.id,
        student: request.student,
        score: round(Object.values(components).reduce((sum, value) => sum + value, 0)),
        components,
        waitingMinutes: ageMinutes,
        gpuHours,
        activeGpu,
        eligible: rankedNodes.length > 0,
        recommendedNode: rankedNodes[0]
          ? { id: rankedNodes[0].node.id, name: rankedNodes[0].node.name, score: rankedNodes[0].score, components: rankedNodes[0].components }
          : null,
      };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.requestId - b.requestId)
    .map((decision, index) => ({ ...decision, rank: index + 1 }));

  return {
    algorithm: ALGORITHM_VERSION,
    method: "Explainable multi-objective fair scheduling",
    generatedAt: now.toISOString(),
    fairnessIndex,
    decisions,
  };
}

module.exports = { ALGORITHM_VERSION, buildSchedulingSnapshot, jainFairness, rankGpuNodes, waitingMinutes };
