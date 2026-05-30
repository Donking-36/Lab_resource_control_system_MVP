const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = process.env.LAB_MVP_DB || path.join(DATA_DIR, "lab_resource.db");
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gpu_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gpu TEXT NOT NULL,
      total_gpu INTEGER NOT NULL,
      used_gpu INTEGER NOT NULL,
      memory_total INTEGER NOT NULL,
      memory_used INTEGER NOT NULL,
      mount TEXT NOT NULL,
      ports_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student TEXT NOT NULL,
      topic TEXT NOT NULL,
      gpus INTEGER NOT NULL,
      hours INTEGER NOT NULL,
      urgency INTEGER NOT NULL,
      image TEXT NOT NULL,
      dataset TEXT NOT NULL,
      credit INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandboxes (
      id TEXT PRIMARY KEY,
      student TEXT NOT NULL,
      node_id TEXT NOT NULL,
      gpus INTEGER NOT NULL,
      port INTEGER NOT NULL,
      image TEXT NOT NULL,
      dataset TEXT NOT NULL,
      status TEXT NOT NULL,
      snapshots INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student TEXT NOT NULL,
      topic TEXT NOT NULL,
      gpu_hours INTEGER NOT NULL,
      last_update_days INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rotation_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rotation_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      progress INTEGER NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (rotation_id) REFERENCES rotations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student TEXT NOT NULL UNIQUE,
      score INTEGER NOT NULL,
      code INTEGER NOT NULL,
      efficiency INTEGER NOT NULL,
      delivery INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      owner TEXT NOT NULL,
      ancestor TEXT NOT NULL,
      issue TEXT NOT NULL,
      solution TEXT NOT NULL,
      repo TEXT NOT NULL
    );
  `);
}

function insertGpuNode(node) {
  db.prepare(`
    INSERT INTO gpu_nodes (id, name, gpu, total_gpu, used_gpu, memory_total, memory_used, mount, ports_json, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    node.id,
    node.name,
    node.gpu,
    node.totalGpu,
    node.usedGpu,
    node.memoryTotal,
    node.memoryUsed,
    node.mount,
    JSON.stringify(node.ports),
    node.source || "seed",
    nowText(),
  );
}

function seedData() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM gpu_nodes").get().count;
  if (count) return;

  [
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
  ].forEach(insertGpuNode);

  const insertRequest = db.prepare(`
    INSERT INTO requests (student, topic, gpus, hours, urgency, image, dataset, credit, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRequest.run("赵明", "目标检测", 1, 9, 4, "pytorch-2.3-cuda12", "/datasets/detection", 92, "waiting", "09:20");
  insertRequest.run("陈曦", "医学图像分割", 2, 22, 5, "pytorch-1.13-cuda11", "/datasets/medical-seg", 84, "waiting", "10:05");

  const insertSandbox = db.prepare(`
    INSERT INTO sandboxes (id, student, node_id, gpus, port, image, dataset, status, snapshots)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSandbox.run("lab-rot-chenxi", "陈曦", "node-a100-01", 2, 8803, "pytorch-1.13-cuda11", "/datasets/medical-seg", "running", 1);
  insertSandbox.run("lab-rot-wuyang", "吴洋", "node-4090-02", 1, 8811, "pytorch-2.3-cuda12", "/datasets/detection", "running", 0);

  const rotationSeed = [
    {
      student: "陈曦",
      topic: "医学图像分割",
      gpuHours: 86,
      lastUpdateDays: 6,
      stages: [
        ["文献调研", 100],
        ["复现 Baseline", 90],
        ["改进网络", 45],
        ["消融实验", 15],
        ["论文撰写", 0],
      ],
    },
    {
      student: "赵明",
      topic: "目标检测",
      gpuHours: 31,
      lastUpdateDays: 2,
      stages: [
        ["文献调研", 100],
        ["复现 Baseline", 80],
        ["数据清洗", 65],
        ["模型调参", 35],
        ["总结汇报", 0],
      ],
    },
    {
      student: "林可",
      topic: "小模型微调",
      gpuHours: 12,
      lastUpdateDays: 1,
      stages: [
        ["需求定义", 100],
        ["样本构造", 60],
        ["LoRA 训练", 20],
        ["评测集", 0],
        ["交接文档", 0],
      ],
    },
  ];

  const insertRotation = db.prepare(`
    INSERT INTO rotations (student, topic, gpu_hours, last_update_days)
    VALUES (?, ?, ?, ?)
  `);
  const insertStage = db.prepare(`
    INSERT INTO rotation_stages (rotation_id, name, progress, position)
    VALUES (?, ?, ?, ?)
  `);
  rotationSeed.forEach((rotation) => {
    const result = insertRotation.run(rotation.student, rotation.topic, rotation.gpuHours, rotation.lastUpdateDays);
    rotation.stages.forEach(([name, progress], index) => insertStage.run(result.lastInsertRowid, name, progress, index));
  });

  const insertEvaluation = db.prepare(`
    INSERT INTO evaluations (student, score, code, efficiency, delivery)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertEvaluation.run("陈曦", 82, 78, 80, 88);
  insertEvaluation.run("赵明", 86, 84, 91, 82);

  const insertKnowledge = db.prepare(`
    INSERT INTO knowledge (id, topic, owner, ancestor, issue, solution, repo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertKnowledge.run(
    "k-1",
    "医学图像分割",
    "陈曦",
    "2024 级师姐 王宁",
    "nnUNet 多卡训练显存碎片",
    "固定 batch size 后开启梯度累积，容器镜像锁定 CUDA 11.8。",
    "github.com/lab/medical-seg/tree/nnunet-v2",
  );
  insertKnowledge.run(
    "k-2",
    "目标检测",
    "赵明",
    "2023 级师兄 孙航",
    "YOLO 数据增强导致小目标召回下降",
    "关闭过强 Mosaic，补充小目标裁剪样本并重训最后 40 epoch。",
    "github.com/lab/detection/tree/yolo-small-object",
  );
  insertKnowledge.run(
    "k-3",
    "小模型微调",
    "林可",
    "2024 级师兄 刘澈",
    "LoRA 微调后中文术语幻觉",
    "增加术语表检索增强，训练集按任务类别分层采样。",
    "github.com/lab/tiny-llm/tree/lora-rag",
  );
}

function toNode(row) {
  return {
    id: row.id,
    name: row.name,
    gpu: row.gpu,
    totalGpu: row.total_gpu,
    usedGpu: row.used_gpu,
    memoryTotal: row.memory_total,
    memoryUsed: row.memory_used,
    mount: row.mount,
    ports: JSON.parse(row.ports_json || "[]"),
    source: row.source,
    updatedAt: row.updated_at,
  };
}

function queryRealGpuNodes() {
  const output = execFileSync(
    "nvidia-smi",
    ["--query-gpu=index,name,utilization.gpu,memory.total,memory.used", "--format=csv,noheader,nounits"],
    { encoding: "utf8", timeout: 3000 },
  );

  return output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [indexRaw, nameRaw, utilRaw, memoryTotalRaw, memoryUsedRaw] = line.split(",").map((part) => part.trim());
      const index = Number(indexRaw);
      const utilization = Number(utilRaw) || 0;
      const memoryTotalGb = Math.max(1, Math.round((Number(memoryTotalRaw) || 0) / 1024));
      const memoryUsedGb = Math.max(0, Math.round((Number(memoryUsedRaw) || 0) / 1024));
      return {
        id: `local-gpu-${index}`,
        name: `GPU-${index} ${nameRaw}`,
        gpu: `1 x ${nameRaw}`,
        totalGpu: 1,
        usedGpu: utilization > 5 || memoryUsedGb > 0 ? 1 : 0,
        memoryTotal: memoryTotalGb,
        memoryUsed: memoryUsedGb,
        mount: ROOT,
        ports: [8801 + index * 10, 8802 + index * 10, 8803 + index * 10, 8804 + index * 10],
        source: "nvidia-smi",
      };
    });
}

function upsertRealGpuNode(node) {
  const existing = db.prepare("SELECT ports_json FROM gpu_nodes WHERE id = ?").get(node.id);
  const ports = existing ? existing.ports_json : JSON.stringify(node.ports);
  db.prepare(`
    INSERT INTO gpu_nodes (id, name, gpu, total_gpu, used_gpu, memory_total, memory_used, mount, ports_json, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      gpu = excluded.gpu,
      total_gpu = excluded.total_gpu,
      used_gpu = excluded.used_gpu,
      memory_total = excluded.memory_total,
      memory_used = excluded.memory_used,
      mount = excluded.mount,
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run(
    node.id,
    node.name,
    node.gpu,
    node.totalGpu,
    node.usedGpu,
    node.memoryTotal,
    node.memoryUsed,
    node.mount,
    ports,
    node.source,
    nowText(),
  );
}

function getGpuNodes() {
  try {
    const realNodes = queryRealGpuNodes();
    if (realNodes.length) {
      realNodes.forEach(upsertRealGpuNode);
      return {
        nodes: db.prepare("SELECT * FROM gpu_nodes ORDER BY source DESC, id").all().map(toNode),
        monitor: { source: "nvidia-smi", updatedAt: nowText() },
      };
    }
  } catch (error) {
    return {
      nodes: db.prepare("SELECT * FROM gpu_nodes WHERE source != 'nvidia-smi' ORDER BY id").all().map(toNode),
      monitor: { source: "seed", error: error.message, updatedAt: nowText() },
    };
  }

  return {
    nodes: db.prepare("SELECT * FROM gpu_nodes ORDER BY id").all().map(toNode),
    monitor: { source: "seed", updatedAt: nowText() },
  };
}

function getRequests() {
  return db
    .prepare("SELECT * FROM requests ORDER BY id DESC")
    .all()
    .map((row) => ({
      id: row.id,
      student: row.student,
      topic: row.topic,
      gpus: row.gpus,
      hours: row.hours,
      urgency: row.urgency,
      image: row.image,
      dataset: row.dataset,
      credit: row.credit,
      status: row.status,
      createdAt: row.created_at,
    }));
}

function getSandboxes() {
  return db
    .prepare("SELECT * FROM sandboxes ORDER BY id")
    .all()
    .map((row) => ({
      id: row.id,
      student: row.student,
      nodeId: row.node_id,
      gpus: row.gpus,
      port: row.port,
      image: row.image,
      dataset: row.dataset,
      status: row.status,
      snapshots: row.snapshots,
    }));
}

function getRotations() {
  return db
    .prepare("SELECT * FROM rotations ORDER BY id")
    .all()
    .map((row) => ({
      id: row.id,
      student: row.student,
      topic: row.topic,
      gpuHours: row.gpu_hours,
      lastUpdateDays: row.last_update_days,
      stages: db
        .prepare("SELECT id, name, progress FROM rotation_stages WHERE rotation_id = ? ORDER BY position")
        .all(row.id),
    }));
}

function getEvaluations() {
  return db.prepare("SELECT student, score, code, efficiency, delivery FROM evaluations ORDER BY id").all();
}

function getKnowledge() {
  return db.prepare("SELECT id, topic, owner, ancestor, issue, solution, repo FROM knowledge ORDER BY id").all();
}

function getState() {
  const gpu = getGpuNodes();
  return {
    gpuNodes: gpu.nodes,
    gpuMonitor: gpu.monitor,
    requests: getRequests(),
    sandboxes: getSandboxes(),
    rotations: getRotations(),
    evaluations: getEvaluations(),
    knowledge: getKnowledge(),
  };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON 格式错误"));
      }
    });
  });
}

function assertText(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new HttpError(400, `${field} 不能为空`);
  return text;
}

function assertNumber(value, field, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, `${field} 必须在 ${min}-${max} 之间`);
  }
  return Math.round(number);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function createRequest(body) {
  const student = assertText(body.student, "轮转生");
  const topic = assertText(body.topic, "研究方向");
  const dataset = assertText(body.dataset, "数据集挂载");
  const gpus = assertNumber(body.gpus, "GPU 数", 1, 8);
  const hours = assertNumber(body.hours, "预计时长", 1, 168);
  const urgency = assertNumber(body.urgency, "紧急程度", 1, 5);
  const image = assertText(body.image, "镜像模板");
  const credit = 80 + Math.floor(Math.random() * 18);

  db.prepare(`
    INSERT INTO requests (student, topic, gpus, hours, urgency, image, dataset, credit, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)
  `).run(student, topic, gpus, hours, urgency, image, dataset, credit, nowText());
}

function approveRequest(id) {
  const request = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
  if (!request) throw new HttpError(404, "申请不存在");
  if (request.status !== "waiting") throw new HttpError(409, "申请不在待分配状态");

  const gpu = getGpuNodes();
  const node = gpu.nodes
    .filter((item) => item.totalGpu - item.usedGpu >= request.gpus && item.ports.length)
    .sort((a, b) => a.usedGpu / a.totalGpu - b.usedGpu / b.totalGpu)[0];

  if (!node) throw new HttpError(409, "当前没有满足条件的 GPU 节点或空闲端口");

  const ports = [...node.ports];
  const port = ports.shift();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE gpu_nodes SET used_gpu = ?, memory_used = ?, ports_json = ?, updated_at = ? WHERE id = ?").run(
      Math.min(node.totalGpu, node.usedGpu + request.gpus),
      Math.min(node.memoryTotal, node.memoryUsed + request.gpus * 18),
      JSON.stringify(ports),
      nowText(),
      node.id,
    );
    db.prepare("UPDATE requests SET status = 'allocated' WHERE id = ?").run(id);
    db.prepare(`
      INSERT OR REPLACE INTO sandboxes (id, student, node_id, gpus, port, image, dataset, status, snapshots)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 0)
    `).run(`lab-rot-${id}`, request.student, node.id, request.gpus, port, request.image, request.dataset);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function rejectRequest(id) {
  const result = db.prepare("UPDATE requests SET status = 'rejected' WHERE id = ? AND status = 'waiting'").run(id);
  if (!result.changes) throw new HttpError(404, "待驳回申请不存在");
}

function releaseSandbox(id) {
  const box = db.prepare("SELECT * FROM sandboxes WHERE id = ?").get(id);
  if (!box) throw new HttpError(404, "沙箱不存在");
  const node = db.prepare("SELECT * FROM gpu_nodes WHERE id = ?").get(box.node_id);
  db.exec("BEGIN");
  try {
    if (node) {
      const ports = JSON.parse(node.ports_json || "[]");
      if (!ports.includes(box.port)) ports.push(box.port);
      ports.sort((a, b) => a - b);
      db.prepare("UPDATE gpu_nodes SET used_gpu = ?, memory_used = ?, ports_json = ?, updated_at = ? WHERE id = ?").run(
        Math.max(0, node.used_gpu - box.gpus),
        Math.max(0, node.memory_used - box.gpus * 18),
        JSON.stringify(ports),
        nowText(),
        box.node_id,
      );
    }
    db.prepare("DELETE FROM sandboxes WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function toggleSandbox(id) {
  const box = db.prepare("SELECT status FROM sandboxes WHERE id = ?").get(id);
  if (!box) throw new HttpError(404, "沙箱不存在");
  const status = box.status === "running" ? "paused" : "running";
  db.prepare("UPDATE sandboxes SET status = ? WHERE id = ?").run(status, id);
}

function snapshotSandbox(id) {
  const result = db.prepare("UPDATE sandboxes SET snapshots = snapshots + 1 WHERE id = ?").run(id);
  if (!result.changes) throw new HttpError(404, "沙箱不存在");
}

function progressRotation(id) {
  const rotation = db.prepare("SELECT id FROM rotations WHERE id = ?").get(id);
  if (!rotation) throw new HttpError(404, "轮转记录不存在");
  const stage = db
    .prepare("SELECT id, progress FROM rotation_stages WHERE rotation_id = ? AND progress < 100 ORDER BY position LIMIT 1")
    .get(id);
  if (!stage) throw new HttpError(409, "轮转任务已完成");
  db.prepare("UPDATE rotation_stages SET progress = ? WHERE id = ?").run(Math.min(100, stage.progress + 15), stage.id);
  db.prepare("UPDATE rotations SET last_update_days = 0 WHERE id = ?").run(id);
}

function remindRotation(id) {
  const result = db
    .prepare("UPDATE rotations SET last_update_days = MAX(0, last_update_days - 2) WHERE id = ?")
    .run(id);
  if (!result.changes) throw new HttpError(404, "轮转记录不存在");
}

function saveEvaluation(body) {
  const student = assertText(body.student, "学生");
  const code = assertNumber(body.code, "代码提交", 0, 100);
  const efficiency = assertNumber(body.efficiency, "算力效率", 0, 100);
  const delivery = assertNumber(body.delivery, "按期完成", 0, 100);
  const score = assertNumber(body.score, "综合评分", 0, 100);

  db.prepare(`
    INSERT INTO evaluations (student, score, code, efficiency, delivery)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(student) DO UPDATE SET
      score = excluded.score,
      code = excluded.code,
      efficiency = excluded.efficiency,
      delivery = excluded.delivery
  `).run(student, score, code, efficiency, delivery);
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    json(res, 200, { ok: true, database: DB_PATH, time: nowText() });
    return;
  }
  if (req.method === "GET" && pathname === "/api/state") {
    json(res, 200, getState());
    return;
  }
  if (req.method === "GET" && pathname === "/api/gpu-nodes") {
    const gpu = getGpuNodes();
    json(res, 200, { gpuNodes: gpu.nodes, gpuMonitor: gpu.monitor });
    return;
  }
  if (req.method === "POST" && pathname === "/api/requests") {
    createRequest(await readJson(req));
    json(res, 201, getState());
    return;
  }

  const approveMatch = pathname.match(/^\/api\/requests\/(\d+)\/approve$/);
  if (req.method === "POST" && approveMatch) {
    approveRequest(Number(approveMatch[1]));
    json(res, 200, getState());
    return;
  }

  const rejectMatch = pathname.match(/^\/api\/requests\/(\d+)\/reject$/);
  if (req.method === "POST" && rejectMatch) {
    rejectRequest(Number(rejectMatch[1]));
    json(res, 200, getState());
    return;
  }

  const sandboxMatch = pathname.match(/^\/api\/sandboxes\/([^/]+)$/);
  if (req.method === "DELETE" && sandboxMatch) {
    releaseSandbox(decodeURIComponent(sandboxMatch[1]));
    json(res, 200, getState());
    return;
  }

  const sandboxActionMatch = pathname.match(/^\/api\/sandboxes\/([^/]+)\/(toggle|snapshot)$/);
  if (req.method === "POST" && sandboxActionMatch) {
    const id = decodeURIComponent(sandboxActionMatch[1]);
    if (sandboxActionMatch[2] === "toggle") toggleSandbox(id);
    if (sandboxActionMatch[2] === "snapshot") snapshotSandbox(id);
    json(res, 200, getState());
    return;
  }

  const rotationMatch = pathname.match(/^\/api\/rotations\/(\d+)\/(progress|remind)$/);
  if (req.method === "POST" && rotationMatch) {
    const id = Number(rotationMatch[1]);
    if (rotationMatch[2] === "progress") progressRotation(id);
    if (rotationMatch[2] === "remind") remindRotation(id);
    json(res, 200, getState());
    return;
  }

  if (req.method === "POST" && pathname === "/api/evaluations") {
    saveEvaluation(await readJson(req));
    json(res, 200, getState());
    return;
  }

  throw new HttpError(404, "接口不存在");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, normalized);
  if (!filePath.startsWith(ROOT)) throw new HttpError(403, "禁止访问");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new HttpError(404, "文件不存在");

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    if (req.method !== "GET") throw new HttpError(405, "方法不允许");
    serveStatic(req, res, url.pathname);
  } catch (error) {
    const status = error.status || 500;
    if (req.url?.startsWith("/api/")) {
      json(res, status, { error: error.message || "服务器错误" });
      return;
    }
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error.message || "服务器错误");
  }
}

createSchema();
seedData();

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`Lab Resource MVP backend running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
