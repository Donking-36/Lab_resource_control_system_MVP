function createEvaluationService({ repositories, assertNumber, assertText }) {
  function saveEvaluation(body) {
    const student = assertText(body.student, "学生");
    const code = assertNumber(body.code, "代码提交", 0, 100);
    const efficiency = assertNumber(body.efficiency, "算力效率", 0, 100);
    const delivery = assertNumber(body.delivery, "按期完成", 0, 100);
    const score = assertNumber(body.score, "综合评分", 0, 100);

    repositories.upsertEvaluation({ student, score, code, efficiency, delivery });
  }

  return {
    saveEvaluation,
  };
}

module.exports = {
  createEvaluationService,
};
