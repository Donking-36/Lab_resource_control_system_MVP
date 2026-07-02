const fs = require("node:fs");
const path = require("node:path");
const { runComparison } = require("../src/server/simulator");

const POLICY_LABELS = { fifo: "FIFO", sjf: "Shortest Job First", "xfs-v1": "XFS-V1" };

function toCsv(report) {
  const rows = [
    ["policy", "avgWaitHours", "p95WaitHours", "jainIndex", "gpuUtilization", "throughputPerHour", "starvationRate"],
  ];
  Object.entries(report.results).forEach(([policy, metric]) => {
    rows.push([
      policy,
      metric.avgWaitHours.mean,
      metric.p95WaitHours.mean,
      metric.jainIndex.mean,
      metric.gpuUtilization.mean,
      metric.throughputPerHour.mean,
      metric.starvationRate.mean,
    ]);
  });
  return rows.map((row) => row.join(",")).join("\n") + "\n";
}

function toMarkdown(report) {
  const lines = [];
  lines.push("# 调度算法对照实验报告");
  lines.push("");
  lines.push(`- 算法版本：\`${report.algorithmVersion}\``);
  lines.push(`- 随机种子：\`${report.seed}\`，重复 ${report.trials} 次，每次 ${report.requestsPerTrial} 条申请，集群 ${report.totalGpu} 张 GPU`);
  lines.push(`- XFS 权重：申请 ${JSON.stringify(report.weights.request)}，节点 ${JSON.stringify(report.weights.node)}`);
  lines.push(`- 饥饿阈值：${report.starvationThresholdHours} 小时`);
  lines.push("");
  lines.push("| 指标 | FIFO | SJF | XFS-V1 |");
  lines.push("| --- | --- | --- | --- |");
  const metricRows = [
    ["平均等待(h)", "avgWaitHours"],
    ["P95 等待(h)", "p95WaitHours"],
    ["Jain 指数", "jainIndex"],
    ["GPU 利用率", "gpuUtilization"],
    ["吞吐量(/h)", "throughputPerHour"],
    ["饥饿率", "starvationRate"],
  ];
  metricRows.forEach(([label, key]) => {
    const cell = (policy) => `${report.results[policy][key].mean} ± ${report.results[policy][key].std}`;
    lines.push(`| ${label} | ${cell("fifo")} | ${cell("sjf")} | ${cell("xfs-v1")} |`);
  });
  lines.push("");
  lines.push("> 每格为 30 次重复的均值 ± 标准差。三种策略共用同一到达序列与严格顺位分配机制，唯一变量是排序策略；");
  lines.push("> XFS-V1 直接复用生产调度器的打分函数，因此排名可解释。");
  lines.push("");
  Object.keys(POLICY_LABELS).forEach((policy) => {
    lines.push(`- ${POLICY_LABELS[policy]} = \`${policy}\``);
  });
  lines.push("");
  return lines.join("\n");
}

function main() {
  const report = runComparison();
  const outDir = path.join(__dirname, "..", "reports", "algorithm");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "report.csv"), toCsv(report));
  fs.writeFileSync(path.join(outDir, "report.md"), toMarkdown(report));
  console.log(`算法对照报告已写入 ${outDir}（report.json / report.csv / report.md）`);
}

main();
