(function initKnowledgeRenderer(root, factory) {
  root.LabRenderParts = root.LabRenderParts || {};
  root.LabRenderParts.knowledge = factory();
})(typeof globalThis !== "undefined" ? globalThis : self, function createKnowledgePart() {
  function createKnowledgeRenderer({ state, els, documentRef, rules }) {
    const { escapeHtml } = rules;

    function renderKnowledge() {
      const filter = documentRef.querySelector("#knowledgeFilter").value;
      const records = state.knowledge.filter((item) => filter === "all" || item.topic === filter);

      els.knowledgeList.innerHTML = records
        .map(
          (item) => `
            <article class="knowledge-item">
              <header>
                <div>
                  <h3>${escapeHtml(item.topic)}</h3>
                  <p>${escapeHtml(item.owner)} 接续 ${escapeHtml(item.ancestor)}</p>
                </div>
                <span class="chip">${escapeHtml(item.repo.split("/").slice(-1)[0])}</span>
              </header>
              <p><strong>问题：</strong>${escapeHtml(item.issue)}</p>
              <p><strong>方案：</strong>${escapeHtml(item.solution)}</p>
              <p><strong>代码：</strong>${escapeHtml(item.repo)}</p>
            </article>
          `,
        )
        .join("");

      renderKnowledgeGraph(records);
    }

    function renderKnowledgeGraph(records) {
      const center = { x: 360, y: 170, label: "实验室资产", type: "topic" };
      const nodes = [center];
      const links = [];

      records.forEach((item, index) => {
        const baseY = 76 + index * 96;
        const topic = { x: 178, y: baseY, label: item.topic, type: "topic" };
        const owner = { x: 360, y: baseY + 34, label: item.owner, type: "student" };
        const issue = { x: 548, y: baseY, label: "报错经验", type: "issue" };
        const code = { x: 548, y: baseY + 64, label: "代码分支", type: "code" };
        nodes.push(topic, owner, issue, code);
        links.push([center, topic], [topic, owner], [owner, issue], [owner, code]);
      });

      const linkMarkup = links
        .map(
          ([from, to]) =>
            `<line class="graph-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`,
        )
        .join("");
      const nodeMarkup = nodes
        .map(
          (node) => `
            <g>
              <circle class="graph-node ${node.type}" cx="${node.x}" cy="${node.y}" r="34"></circle>
              <text class="graph-label" x="${node.x}" y="${node.y + 5}">${escapeHtml(node.label)}</text>
            </g>
          `,
        )
        .join("");

      els.knowledgeGraph.innerHTML = `${linkMarkup}${nodeMarkup}`;
    }

    return {
      renderKnowledge,
      renderKnowledgeGraph,
    };
  }

  return {
    createKnowledgeRenderer,
  };
});
