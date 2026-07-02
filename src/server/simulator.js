const { ALGORITHM_VERSION, buildSchedulingSnapshot, jainFairness } = require("./scheduler");

// XFS-V1 weight snapshot recorded alongside every report so results stay
// interpretable and reproducible when weights change (bump the version then).
const XFS_WEIGHTS = {
  request: { urgency: 35, credit: 20, aging: 15, efficiency: 15, fairness: 15 },
  node: { capacity: 45, memory: 30, bestFit: 15, sourceTrust: 10 },
};

const POLICIES = ["fifo", "sjf", "xfs-v1"];
const STARVATION_THRESHOLD_HOURS = 12;
const SIM_BASE_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

// Deterministic PRNG so a given seed always reproduces the same workload.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// A heterogeneous set of requests: varied GPU counts, durations, urgency and
// arrival times, spread across a pool of students to exercise fairness.
function generateWorkload(rng, count, totalGpu) {
  const students = ["林可", "赵明", "陈曦", "吴洋", "孙航", "周芸"];
  const requests = [];
  let arrival = 0;
  for (let i = 0; i < count; i += 1) {
    arrival += randInt(rng, 0, 1);
    requests.push({
      id: i + 1,
      student: students[randInt(rng, 0, students.length - 1)],
      gpus: Math.min(totalGpu, randInt(rng, 1, 3)),
      hours: randInt(rng, 1, 8),
      urgency: randInt(rng, 1, 5),
      credit: randInt(rng, 70, 97),
      arrival,
    });
  }
  return requests;
}

function isoAt(hours) {
  return new Date(SIM_BASE_MS + hours * 3600000).toISOString();
}

// Ranks the currently-waiting requests according to the chosen policy.
// FIFO and SJF sort directly; XFS-V1 reuses the production scheduler so the
// simulation exercises the exact scoring shipped to users.
function orderWaiting(waiting, policy, context) {
  if (policy === "fifo") {
    return [...waiting].sort((a, b) => a.arrival - b.arrival || a.id - b.id);
  }
  if (policy === "sjf") {
    return [...waiting].sort((a, b) => a.gpus * a.hours - b.gpus * b.hours || a.arrival - b.arrival || a.id - b.id);
  }

  const { totalGpu, usedGpu, running, t } = context;
  const nodes = [
    {
      id: "sim-node",
      name: "sim-node",
      totalGpu,
      usedGpu,
      memoryTotal: totalGpu * 40,
      memoryUsed: usedGpu * 40,
      ports: Array.from({ length: totalGpu }, (_, index) => 9000 + index),
      source: "seed",
    },
  ];
  const snapshot = buildSchedulingSnapshot({
    requests: waiting.map((request) => ({
      id: request.id,
      student: request.student,
      gpus: request.gpus,
      hours: request.hours,
      urgency: request.urgency,
      credit: request.credit,
      status: "waiting",
      createdAt: isoAt(request.arrival),
    })),
    sandboxes: running.map((request) => ({ student: request.student, gpus: request.gpus })),
    gpuNodes: nodes,
    now: new Date(SIM_BASE_MS + t * 3600000),
  });
  const rankById = new Map(snapshot.decisions.map((decision, index) => [decision.requestId, index]));
  return [...waiting].sort((a, b) => (rankById.get(a.id) ?? 1e9) - (rankById.get(b.id) ?? 1e9));
}

// Event-stepped simulation. All policies share one allocation discipline
// (strict head-of-line blocking in priority order) so the only variable is
// the ordering produced by the policy.
function simulate(requestsInput, totalGpu, policy) {
  const requests = requestsInput.map((request) => ({ ...request, start: null, end: null }));
  const students = [...new Set(requests.map((request) => request.student))];
  const waiting = [];
  const running = [];
  const queued = new Set();
  let usedGpu = 0;
  let allocatedCount = 0;
  let t = Math.min(...requests.map((request) => request.arrival));
  let guard = 0;
  // Time-weighted Jain fairness of per-student active GPUs across the run.
  let jainAccum = 0;
  let timeAccum = 0;

  while (allocatedCount < requests.length && guard < 1000000) {
    guard += 1;

    for (let i = running.length - 1; i >= 0; i -= 1) {
      if (running[i].end <= t) {
        usedGpu -= running[i].gpus;
        running.splice(i, 1);
      }
    }
    requests.forEach((request) => {
      if (request.start === null && !queued.has(request.id) && request.arrival <= t) {
        queued.add(request.id);
        waiting.push(request);
      }
    });

    const order = orderWaiting(waiting, policy, { totalGpu, usedGpu, running, t });
    let allocated = false;
    for (const request of order) {
      if (request.gpus > totalGpu - usedGpu) break; // strict head-of-line blocking
      request.start = t;
      request.end = t + request.hours;
      usedGpu += request.gpus;
      running.push(request);
      waiting.splice(waiting.indexOf(request), 1);
      allocatedCount += 1;
      allocated = true;
    }
    if (allocated) continue;

    const nextArrival = Math.min(
      ...requests.filter((request) => request.start === null && !queued.has(request.id)).map((request) => request.arrival),
      Infinity,
    );
    const nextCompletion = running.length ? Math.min(...running.map((request) => request.end)) : Infinity;
    const next = Math.min(nextArrival, nextCompletion);
    if (!Number.isFinite(next)) break;

    const interval = next - t;
    if (interval > 0) {
      const active = new Map();
      running.forEach((request) => active.set(request.student, (active.get(request.student) || 0) + request.gpus));
      jainAccum += jainFairness(students.map((student) => active.get(student) || 0)) * interval;
      timeAccum += interval;
    }
    t = next;
  }

  return computeMetrics(requests, totalGpu, timeAccum > 0 ? jainAccum / timeAccum : 1);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))];
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function computeMetrics(requests, totalGpu, timeAveragedJain) {
  const waits = requests.map((request) => (request.start ?? request.arrival) - request.arrival);
  const avgWait = waits.reduce((sum, value) => sum + value, 0) / waits.length;
  const makespan = Math.max(...requests.map((request) => request.end ?? request.arrival)) - Math.min(...requests.map((request) => request.arrival));
  const gpuHoursUsed = requests.reduce((sum, request) => sum + request.gpus * request.hours, 0);
  const utilization = makespan > 0 ? gpuHoursUsed / (totalGpu * makespan) : 0;
  const starved = waits.filter((wait) => wait > STARVATION_THRESHOLD_HOURS).length;

  return {
    avgWaitHours: round(avgWait),
    p95WaitHours: round(percentile(waits, 95)),
    jainIndex: round(timeAveragedJain),
    gpuUtilization: round(Math.min(1, utilization)),
    throughputPerHour: round(makespan > 0 ? requests.length / makespan : requests.length),
    starvationRate: round(starved / requests.length),
    makespanHours: round(makespan),
  };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2)));
}

function aggregate(trialMetrics) {
  const keys = Object.keys(trialMetrics[0]);
  const result = {};
  keys.forEach((key) => {
    const values = trialMetrics.map((metric) => metric[key]);
    result[key] = { mean: round(mean(values)), std: round(std(values)) };
  });
  return result;
}

// Runs `trials` independent seeded workloads through every policy and reports
// per-policy mean/std for each metric. Deterministic for a given seed.
function runComparison({ seed = 20240607, count = 36, trials = 30, totalGpu = 8 } = {}) {
  const perPolicy = { fifo: [], sjf: [], "xfs-v1": [] };
  for (let trial = 0; trial < trials; trial += 1) {
    const rng = mulberry32(seed + trial);
    const workload = generateWorkload(rng, count, totalGpu);
    POLICIES.forEach((policy) => {
      perPolicy[policy].push(simulate(workload, totalGpu, policy));
    });
  }

  const results = {};
  POLICIES.forEach((policy) => {
    results[policy] = aggregate(perPolicy[policy]);
  });

  return {
    algorithmVersion: ALGORITHM_VERSION,
    weights: XFS_WEIGHTS,
    seed,
    trials,
    requestsPerTrial: count,
    totalGpu,
    starvationThresholdHours: STARVATION_THRESHOLD_HOURS,
    metrics: {
      avgWaitHours: "从到达到分配的平均等待（小时）",
      p95WaitHours: "最慢 5% 申请的等待（小时）",
      jainIndex: "学生 GPU-小时占用的 Jain 公平指数（越接近 1 越公平）",
      gpuUtilization: "已用 GPU-小时 / (总 GPU × makespan)",
      throughputPerHour: "单位时间完成分配的申请数",
      starvationRate: `等待超过 ${STARVATION_THRESHOLD_HOURS} 小时的申请占比`,
    },
    results,
  };
}

module.exports = {
  runComparison,
  simulate,
  generateWorkload,
  mulberry32,
  XFS_WEIGHTS,
  POLICIES,
};
