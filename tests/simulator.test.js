const assert = require("node:assert/strict");

const { runComparison, simulate, generateWorkload, mulberry32, POLICIES } = require("../src/server/simulator");

const METRIC_KEYS = ["avgWaitHours", "p95WaitHours", "jainIndex", "gpuUtilization", "throughputPerHour", "starvationRate"];

// Determinism: identical seed → identical report.
assert.equal(JSON.stringify(runComparison({ trials: 5 })), JSON.stringify(runComparison({ trials: 5 })));

// Report structure carries version, weights and per-policy mean/std.
{
  const report = runComparison({ trials: 3 });
  assert.equal(report.algorithmVersion, "xfs-v1");
  assert.equal(report.weights.request.urgency, 35);
  POLICIES.forEach((policy) => {
    assert.ok(report.results[policy], policy);
    METRIC_KEYS.forEach((key) => {
      assert.equal(typeof report.results[policy][key].mean, "number");
      assert.equal(typeof report.results[policy][key].std, "number");
    });
  });
}

// Invariants: metrics stay in valid ranges and never over-allocate.
{
  const workload = generateWorkload(mulberry32(1), 20, 8);
  POLICIES.forEach((policy) => {
    const metric = simulate(workload, 8, policy);
    assert.ok(metric.avgWaitHours >= 0);
    assert.ok(metric.gpuUtilization >= 0 && metric.gpuUtilization <= 1, `utilization ${metric.gpuUtilization}`);
    assert.ok(metric.jainIndex > 0 && metric.jainIndex <= 1, `jain ${metric.jainIndex}`);
    assert.ok(metric.starvationRate >= 0 && metric.starvationRate <= 1);
  });
}

// Per-policy determinism on a fixed heterogeneous workload.
{
  const workload = generateWorkload(mulberry32(3), 30, 8);
  assert.equal(JSON.stringify(simulate(workload, 8, "xfs-v1")), JSON.stringify(simulate(workload, 8, "xfs-v1")));
}

// Resource insufficiency: a request larger than the whole cluster must not hang.
{
  const impossible = [{ id: 1, student: "a", gpus: 99, hours: 5, urgency: 3, credit: 85, arrival: 0 }];
  const metric = simulate(impossible, 4, "fifo");
  assert.ok(Number.isFinite(metric.avgWaitHours));
  assert.ok(Number.isFinite(metric.makespanHours));
}

// Cross-midnight aging: arrivals spanning well beyond 24h still rank cleanly.
{
  const spanning = [];
  for (let i = 0; i < 8; i += 1) {
    spanning.push({ id: i + 1, student: `s${i % 3}`, gpus: 2, hours: 6, urgency: 3, credit: 85, arrival: i * 10 });
  }
  const metric = simulate(spanning, 4, "xfs-v1");
  assert.ok(metric.avgWaitHours >= 0);
  assert.ok(Number.isFinite(metric.p95WaitHours));
}

console.log("Simulator tests passed");
