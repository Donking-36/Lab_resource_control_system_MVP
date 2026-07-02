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

function createRepositories(db, { containerPort, inspectContainerStatus }) {
  return {
    begin() {
      db.exec("BEGIN IMMEDIATE");
    },

    commit() {
      db.exec("COMMIT");
    },

    rollback() {
      db.exec("ROLLBACK");
    },

    getGpuNodes() {
      return db.prepare("SELECT * FROM gpu_nodes ORDER BY id").all().map(toNode);
    },

    getSeedGpuNodes() {
      return db.prepare("SELECT * FROM gpu_nodes WHERE source != 'nvidia-smi' ORDER BY id").all().map(toNode);
    },

    getGpuNodesBySource() {
      return db.prepare("SELECT * FROM gpu_nodes WHERE source = 'nvidia-smi' ORDER BY id").all().map(toNode);
    },

    upsertRealGpuNode(node, nowText) {
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
        nowText,
      );
    },

    getRequests() {
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
    },

    getRequestById(id) {
      return db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
    },

    insertRequest(request) {
      return db.prepare(`
        INSERT INTO requests (student, topic, gpus, hours, urgency, image, dataset, credit, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)
      `).run(
        request.student,
        request.topic,
        request.gpus,
        request.hours,
        request.urgency,
        request.image,
        request.dataset,
        request.credit,
        request.createdAt,
      );
    },

    appendAudit({ action, entityType, entityId, actor = "system", details = {}, createdAt }) {
      return db
        .prepare(`
          INSERT INTO audit_events (action, entity_type, entity_id, actor, details_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(action, entityType, String(entityId ?? ""), actor, JSON.stringify(details), createdAt);
    },

    getAuditEvents(limit = 30) {
      return db
        .prepare("SELECT * FROM audit_events ORDER BY id DESC LIMIT ?")
        .all(limit)
        .map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          actor: row.actor,
          details: JSON.parse(row.details_json || "{}"),
          createdAt: row.created_at,
        }));
    },

    updateNodeAllocation(nodeId, allocation) {
      db.prepare("UPDATE gpu_nodes SET used_gpu = ?, memory_used = ?, ports_json = ?, updated_at = ? WHERE id = ?").run(
        allocation.usedGpu,
        allocation.memoryUsed,
        allocation.portsJson,
        allocation.updatedAt,
        nodeId,
      );
    },

    markRequestAllocated(id) {
      db.prepare("UPDATE requests SET status = 'allocated' WHERE id = ?").run(id);
    },

    rejectWaitingRequest(id) {
      return db.prepare("UPDATE requests SET status = 'rejected' WHERE id = ? AND status = 'waiting'").run(id).changes;
    },

    insertSandboxFromAllocation({ id, request, nodeId, port, container, createdAt }) {
      db.prepare(`
        INSERT INTO sandboxes (
          id, student, node_id, gpus, port, image, dataset, status, snapshots,
          container_id, container_name, host_port, container_port, mount_path, created_at, last_error, snapshot_image
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 0, ?, ?, ?, ?, ?, ?, '', '')
      `).run(
        id,
        request.student,
        nodeId,
        request.gpus,
        port,
        container.image,
        request.dataset,
        container.containerId,
        container.containerName,
        port,
        container.containerPort,
        container.mountPath,
        createdAt,
      );
    },

    getSandboxes() {
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
          containerId: row.container_id,
          containerShortId: row.container_id ? row.container_id.slice(0, 12) : "",
          containerName: row.container_name,
          hostPort: row.host_port || row.port,
          containerPort: row.container_port || containerPort,
          mountPath: row.mount_path,
          createdAt: row.created_at,
          lastError: row.last_error,
          snapshotImage: row.snapshot_image,
          containerStatus: inspectContainerStatus(row.container_id),
        }));
    },

    getSandboxById(id) {
      return db.prepare("SELECT * FROM sandboxes WHERE id = ?").get(id);
    },

    getGpuNodeRowById(id) {
      return db.prepare("SELECT * FROM gpu_nodes WHERE id = ?").get(id);
    },

    updateSandboxError(id, message) {
      db.prepare("UPDATE sandboxes SET last_error = ? WHERE id = ?").run(message, id);
    },

    updateSandboxStatus(id, status) {
      db.prepare("UPDATE sandboxes SET status = ?, last_error = '' WHERE id = ?").run(status, id);
    },

    updateSandboxSnapshot(id, snapshots, snapshotImage) {
      db.prepare("UPDATE sandboxes SET snapshots = ?, snapshot_image = ?, last_error = '' WHERE id = ?").run(
        snapshots,
        snapshotImage,
        id,
      );
    },

    deleteSandbox(id) {
      db.prepare("DELETE FROM sandboxes WHERE id = ?").run(id);
    },

    getRotations() {
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
    },

    getRotationById(id) {
      return db.prepare("SELECT id FROM rotations WHERE id = ?").get(id);
    },

    getNextIncompleteStage(rotationId) {
      return db
        .prepare("SELECT id, progress FROM rotation_stages WHERE rotation_id = ? AND progress < 100 ORDER BY position LIMIT 1")
        .get(rotationId);
    },

    updateStageProgress(stageId, progress) {
      db.prepare("UPDATE rotation_stages SET progress = ? WHERE id = ?").run(progress, stageId);
    },

    resetRotationUpdateDays(id) {
      db.prepare("UPDATE rotations SET last_update_days = 0 WHERE id = ?").run(id);
    },

    reduceRotationUpdateDays(id) {
      return db.prepare("UPDATE rotations SET last_update_days = MAX(0, last_update_days - 2) WHERE id = ?").run(id).changes;
    },

    getEvaluations() {
      return db.prepare("SELECT student, score, code, efficiency, delivery FROM evaluations ORDER BY id").all();
    },

    upsertEvaluation(evaluation) {
      db.prepare(`
        INSERT INTO evaluations (student, score, code, efficiency, delivery)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(student) DO UPDATE SET
          score = excluded.score,
          code = excluded.code,
          efficiency = excluded.efficiency,
          delivery = excluded.delivery
      `).run(evaluation.student, evaluation.score, evaluation.code, evaluation.efficiency, evaluation.delivery);
    },

    getKnowledge() {
      return db.prepare("SELECT id, topic, owner, ancestor, issue, solution, repo FROM knowledge ORDER BY id").all();
    },

    countUsers() {
      return db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
    },

    getUserByUsername(username) {
      return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    },

    getUserById(id) {
      return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    },

    insertUser(user) {
      return db
        .prepare("INSERT INTO users (username, display_name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(user.username, user.displayName, user.role, user.passwordHash, user.createdAt);
    },

    createSession(session) {
      db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
        session.token,
        session.userId,
        session.expiresAt,
        session.createdAt,
      );
    },

    getSession(token) {
      const row = db
        .prepare(`
          SELECT s.token, s.user_id, s.expires_at, u.username, u.display_name, u.role
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.token = ?
        `)
        .get(token);
      if (!row) return null;
      return {
        token: row.token,
        userId: row.user_id,
        expiresAt: row.expires_at,
        user: { id: row.user_id, username: row.username, displayName: row.display_name, role: row.role },
      };
    },

    deleteSession(token) {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    },

    deleteExpiredSessions(nowMs) {
      db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowMs);
    },
  };
}

module.exports = {
  createRepositories,
  toNode,
};
