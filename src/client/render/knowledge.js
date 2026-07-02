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
      const graphWidth = 720;
      const rootNode = { x: 360, y: 32, width: 126, height: 42, label: "实验室资产", type: "root" };
      const nodes = [rootNode];
      const links = [];
      const rowStart = 122;
      const rowGap = 104;

      function compactLabel(label, maxLength) {
        const value = String(label);
        return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
      }

      records.forEach((item, index) => {
        const baseY = rowStart + index * rowGap;
        const topic = { x: 128, y: baseY, width: 176, height: 44, label: item.topic, type: "topic" };
        const owner = { x: 360, y: baseY, width: 104, height: 44, label: item.owner, type: "student" };
        const issue = { x: 588, y: baseY - 22, width: 116, height: 34, label: "报错经验", type: "issue" };
        const code = { x: 588, y: baseY + 22, width: 116, height: 34, label: "代码分支", type: "code" };
        nodes.push(topic, owner, issue, code);
        links.push([rootNode, owner], [topic, owner], [owner, issue], [owner, code]);
      });

      const graphHeight = Math.max(218, rowStart + Math.max(records.length - 1, 0) * rowGap + 66);
      els.knowledgeGraph.setAttribute("viewBox", `0 0 ${graphWidth} ${graphHeight}`);

      const linkMarkup = links
        .map(
          ([from, to]) =>
            `<line class="graph-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`,
        )
        .join("");
      const headingMarkup = records.length
        ? `
            <text class="graph-column-label" x="128" y="82">研究方向</text>
            <text class="graph-column-label" x="360" y="82">接续人</text>
            <text class="graph-column-label" x="588" y="82">知识沉淀</text>
          `
        : `<text class="graph-empty-label" x="360" y="126">暂无该方向的知识资产</text>`;
      const nodeMarkup = nodes
        .map(
          (node) => `
            <g class="graph-node-group ${node.type}">
              <title>${escapeHtml(node.label)}</title>
              <rect class="graph-node ${node.type}" x="${node.x - node.width / 2}" y="${node.y - node.height / 2}" width="${node.width}" height="${node.height}" rx="${node.height / 2}"></rect>
              <text class="graph-label" x="${node.x}" y="${node.y}">${escapeHtml(compactLabel(node.label, node.type === "topic" ? 9 : 7))}</text>
            </g>
          `,
        )
        .join("");

      els.knowledgeGraph.innerHTML = `${linkMarkup}${headingMarkup}${nodeMarkup}`;
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
