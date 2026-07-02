function createSandboxService({ repositories, docker, HttpError, returnPortToNode, nowText }) {
  function actorOf(user) {
    return user ? String(user.id) : "system";
  }

  function audit(action, id, details = {}, user = null) {
    repositories.appendAudit?.({
      action,
      entityType: "sandbox",
      entityId: id,
      actor: actorOf(user),
      details,
      createdAt: nowText(),
    });
  }

  // Students may only touch their own sandboxes; admins are unrestricted.
  function assertOwnership(box, user) {
    if (user && user.role !== "admin" && box.student !== user.displayName) {
      throw new HttpError(403, "无权操作他人的沙箱", "FORBIDDEN");
    }
  }

  function releaseSandbox(id, user = null) {
    const box = repositories.getSandboxById(id);
    if (!box) throw new HttpError(404, "沙箱不存在");
    assertOwnership(box, user);
    const node = repositories.getGpuNodeRowById(box.node_id);

    let transactionStarted = false;
    repositories.begin();
    transactionStarted = true;
    try {
      docker.removeContainer(box);
      if (node) {
        const returned = returnPortToNode(node, box, nowText());
        repositories.updateNodeAllocation(box.node_id, returned);
      }
      repositories.deleteSandbox(id);
      audit("sandbox.released", id, { nodeId: box.node_id, gpus: box.gpus, port: box.port }, user);
      repositories.commit();
    } catch (error) {
      if (transactionStarted) repositories.rollback();
      try {
        repositories.updateSandboxError(id, error.message);
      } catch {
        // Keep the original release error visible to the caller.
      }
      throw error;
    }
  }

  function toggleSandbox(id, user = null) {
    const box = repositories.getSandboxById(id);
    if (!box) throw new HttpError(404, "沙箱不存在");
    assertOwnership(box, user);
    if (box.status !== "running" && box.status !== "paused") {
      throw new HttpError(409, "沙箱状态不支持暂停或恢复", "SANDBOX_STATE_INVALID");
    }
    const status = box.status === "running" ? "paused" : "running";
    try {
      if (status === "paused") docker.pauseContainer(box);
      if (status === "running") docker.unpauseContainer(box);
      repositories.updateSandboxStatus(id, status);
      audit(`sandbox.${status}`, id, { containerId: box.container_id }, user);
    } catch (error) {
      repositories.updateSandboxError(id, error.message);
      throw error;
    }
  }

  function snapshotSandbox(id, user = null) {
    const box = repositories.getSandboxById(id);
    if (!box) throw new HttpError(404, "沙箱不存在");
    assertOwnership(box, user);
    const nextVersion = box.snapshots + 1;
    try {
      const snapshotImage = docker.commitContainer(box, nextVersion);
      repositories.updateSandboxSnapshot(id, nextVersion, snapshotImage || box.snapshot_image);
      audit("sandbox.snapshotted", id, { version: nextVersion, snapshotImage }, user);
    } catch (error) {
      repositories.updateSandboxError(id, error.message);
      throw error;
    }
  }

  return {
    releaseSandbox,
    toggleSandbox,
    snapshotSandbox,
  };
}

module.exports = {
  createSandboxService,
};
