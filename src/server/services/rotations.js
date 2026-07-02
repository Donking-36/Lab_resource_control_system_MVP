function createRotationService({ repositories, HttpError, nowText = () => "" }) {
  function actorOf(user) {
    return user ? String(user.id) : "system";
  }

  function progressRotation(id, user = null) {
    const rotation = repositories.getRotationById(id);
    if (!rotation) throw new HttpError(404, "轮转记录不存在");
    const stage = repositories.getNextIncompleteStage(id);
    if (!stage) throw new HttpError(409, "轮转任务已完成");
    repositories.updateStageProgress(stage.id, Math.min(100, stage.progress + 15));
    repositories.resetRotationUpdateDays(id);
    repositories.appendAudit?.({
      action: "rotation.progressed",
      entityType: "rotation",
      entityId: id,
      actor: actorOf(user),
      details: { stageId: stage.id, progress: Math.min(100, stage.progress + 15) },
      createdAt: nowText(),
    });
  }

  function remindRotation(id, user = null) {
    if (!repositories.reduceRotationUpdateDays(id)) throw new HttpError(404, "轮转记录不存在");
    repositories.appendAudit?.({
      action: "rotation.reminded",
      entityType: "rotation",
      entityId: id,
      actor: actorOf(user),
      details: {},
      createdAt: nowText(),
    });
  }

  return {
    progressRotation,
    remindRotation,
  };
}

module.exports = {
  createRotationService,
};
