function createEvaluationService({ repositories, assertNumber, assertText, nowText = () => "" }) {
  function saveEvaluation(body) {
    const student = assertText(body.student, "学生");
    const code = assertNumber(body.code, "代码提交", 0, 100);
    const efficiency = assertNumber(body.efficiency, "算力效率", 0, 100);
    const delivery = assertNumber(body.delivery, "按期完成", 0, 100);
    const score = assertNumber(body.score, "综合评分", 0, 100);

    repositories.upsertEvaluation({ student, score, code, efficiency, delivery });
    repositories.appendAudit?.({
      action: "evaluation.saved",
      entityType: "evaluation",
      entityId: student,
      details: { score, code, efficiency, delivery },
      createdAt: nowText(),
    });
  }

  return {
    saveEvaluation,
  };
}

module.exports = {
  createEvaluationService,
};
