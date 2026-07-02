function createRotationService({ repositories, HttpError, nowText = () => "" }) {
  function progressRotation(id) {
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
      details: { stageId: stage.id, progress: Math.min(100, stage.progress + 15) },
      createdAt: nowText(),
    });
  }

  function remindRotation(id) {
    if (!repositories.reduceRotationUpdateDays(id)) throw new HttpError(404, "轮转记录不存在");
    repositories.appendAudit?.({
      action: "rotation.reminded",
      entityType: "rotation",
      entityId: id,
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
