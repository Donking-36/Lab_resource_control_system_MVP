(function initEvaluationRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.evaluations = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createEvaluationPart() {
  function createEvaluationRenderer({ state, els, rules }) {
    const { escapeHtml } = rules;

    function renderEvaluations() {
      const current = els.evaluationStudent.value;
      const students = state.rotations.map((rotation) => rotation.student);
      els.evaluationStudent.innerHTML = students
        .map((student) => `<option value="${escapeHtml(student)}">${escapeHtml(student)}</option>`)
        .join("");
      if (students.includes(current)) {
        els.evaluationStudent.value = current;
      }

      els.evaluationSummary.innerHTML = state.evaluations
        .map(
          (item) => `
            <div class="evaluation-item">
              <strong>${escapeHtml(item.student)} · 综合 ${item.score}</strong>
              <div class="score-line"><span>代码提交</span><span>${item.code}</span></div>
              <div class="score-line"><span>算力效率</span><span>${item.efficiency}</span></div>
              <div class="score-line"><span>按期完成</span><span>${item.delivery}</span></div>
            </div>
          `,
        )
        .join("");
    }

    return {
      renderEvaluations,
    };
  }

  return {
    createEvaluationRenderer,
  };
});
