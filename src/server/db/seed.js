function insertGpuNode(db, node, nowText) {
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

function seedData(db, nowText) {
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
  ].forEach((node) => insertGpuNode(db, node, nowText));

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

module.exports = {
  seedData,
};
