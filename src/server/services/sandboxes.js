function createSandboxService({ repositories, docker, HttpError, returnPortToNode, nowText }) {
  function audit(action, id, details = {}) {
    repositories.appendAudit?.({ action, entityType: "sandbox", entityId: id, details, createdAt: nowText() });
  }

  function releaseSandbox(id) {
    const box = repositories.getSandboxById(id);
    if (!box) throw new HttpError(404, "沙箱不存在");
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
      audit("sandbox.released", id, { nodeId: box.node_id, gpus: box.gpus, port: box.port });
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

  function toggleSandbox(id) {
    const box = repositories.getSandboxById(id);
    if (!box) throw new HttpError(404, "沙箱不存在");
    const status = box.status === "running" ? "paused" : "running";
    try {
      if (status === "paused") docker.pauseContainer(box);
      if (status === "running") docker.unpauseContainer(box);
      repositories.updateSandboxStatus(id, status);
      audit(`sandbox.${status}`, id, { containerId: box.container_id });
    } catch (error) {
      repositories.updateSandboxError(id, error.message);
      throw error;
    }
  }

  function snapshotSandbox(id) {
    const box = repositories.getSandboxById(id);
    if (!box) throw new HttpError(404, "沙箱不存在");
    const nextVersion = box.snapshots + 1;
    try {
      const snapshotImage = docker.commitContainer(box, nextVersion);
      repositories.updateSandboxSnapshot(id, nextVersion, snapshotImage || box.snapshot_image);
      audit("sandbox.snapshotted", id, { version: nextVersion, snapshotImage });
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
