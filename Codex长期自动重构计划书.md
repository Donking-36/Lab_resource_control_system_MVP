# Codex 长期自动重构计划书

## 0. 执行目标

本计划用于让 Codex 在较长时间内自动、渐进地修改当前项目代码，把现有“能演示但结构混乱”的课程大作业 MVP 改造成更清晰、可维护、可测试的模块化工程。

当前项目是一个前后端一体的 Node.js / SQLite / 静态页面 MVP：

- `server.js` 约 993 行，混合了 HTTP 服务、静态文件托管、SQLite schema/seed/migration、Docker CLI、GPU 探测、业务规则、API 路由和错误处理。
- `app.js` 约 547 行，混合了前端全局状态、API 请求、业务计算、DOM 渲染、事件绑定和表单处理。
- `index.html` 约 297 行，页面结构完整但所有区域集中在单文件。
- `styles.css` 约 821 行，样式可运行但缺少分层组织。
- `tests/api.test.js` 已有端到端 API 测试，是重构期间最重要的行为保护。
- 项目文档已经覆盖需求优先级、部署、用户反馈、Docker 验收和后续迭代，重构不能破坏这些文档所描述的演示链路。

重构完成后的目标：

1. 后端按职责拆成配置、数据库、仓储、业务服务、外部适配器、路由、静态服务和应用入口。
2. 前端按职责拆成状态、API、业务计算、渲染模块、事件绑定和入口。
3. 保持现有页面、API 路径、数据库行为和演示文档基本兼容。
4. 增加或调整测试，确保核心链路在每个阶段都可验证。
5. 所有修改仅发生在当前仓库目录内，不批量删除文件。

## 1. 硬性约束

Codex 执行本计划时必须遵守以下规则：

- 只允许修改当前目录 `/home/yanami/Desktop/Lab_resource_control_system_MVP` 内的文件。
- 不要批量删除文件，不要执行 `rm -rf`，不要清空目录。
- 不要删除课程提交材料、截图、用户反馈证据、Docker 验收证据和现有文档。
- 不要重写整个项目为新框架，不要引入 React/Vue/Vite/Express 等大依赖，除非用户明确批准。
- 不要改变公开 API 路径，除非同时保留兼容路由。
- 不要改变 `npm start`、`npm run check`、`npm test` 的语义。
- 不要提交真实数据库文件，继续遵守 `.gitignore` 中的 `data/*.db` 规则。
- 不要伪造 Docker、GPU、用户反馈或测试结果。
- 每次大改前先运行 `git status --short`，确认工作区状态；遇到用户已有改动时，不要覆盖或回滚。
- 每个阶段尽量小步提交代码修改，并在阶段结束运行可用的检查命令。

## 2. 当前主要问题

### 2.1 后端问题

`server.js` 当前承担过多职责：

- 配置常量、Docker 镜像模板和端口配置混在入口文件。
- SQLite schema、迁移、种子数据、查询转换函数都在同一文件。
- Docker 操作与业务审批强耦合，测试时难以替换。
- `nvidia-smi` 探测与 GPU 节点持久化混在一起。
- API 路由通过正则散落在 `handleApi` 中，随着接口增加会继续膨胀。
- 应用启动逻辑在模块顶层执行，导致单元测试很难直接导入函数。

### 2.2 前端问题

`app.js` 当前也是单文件全局脚本：

- `state`、DOM 引用、API 请求、渲染、业务规则和事件处理混在一起。
- `priorityScore`、训练时长估计、风险判断等规则不能被独立测试。
- 大量 `innerHTML` 字符串集中在同一文件，后续维护容易误改。
- 事件绑定依赖全局 DOM 查询，缺少初始化边界。

### 2.3 测试问题

已有 `tests/api.test.js` 覆盖了主要 API 流程，但还不足：

- 测试依赖启动真实 `server.js`，缺少可直接导入的业务单元测试。
- Docker 相关函数在无 Docker 环境下会走错误路径，测试覆盖不够明确。
- 前端业务规则缺少测试。

### 2.4 环境注意事项

当前环境中执行 `npm run check` 可能出现：

```text
WSL 1 is not supported. Please upgrade to WSL 2 or above.
Could not determine Node.js install directory
```

如果 Codex 遇到该问题，不要把它当作代码错误。应记录为本机 Node/WSL 环境限制，并在具备 Node.js 24+ 的环境中复验。仍然可以继续做静态代码阅读和小步重构，但最终验收必须在可运行 Node 24 的环境完成。

## 3. 推荐目标目录结构

最终可以演进到以下结构。不要一次性全部迁移，按阶段逐步创建。

```text
.
├── server.js
├── index.html
├── styles.css
├── app.js
├── package.json
├── src/
│   ├── server/
│   │   ├── config.js
│   │   ├── app.js
│   │   ├── http.js
│   │   ├── errors.js
│   │   ├── db/
│   │   │   ├── connection.js
│   │   │   ├── schema.js
│   │   │   ├── seed.js
│   │   │   └── repositories.js
│   │   ├── services/
│   │   │   ├── requests.js
│   │   │   ├── sandboxes.js
│   │   │   ├── rotations.js
│   │   │   ├── evaluations.js
│   │   │   └── state.js
│   │   ├── adapters/
│   │   │   ├── docker.js
│   │   │   └── gpuMonitor.js
│   │   └── routes/
│   │       ├── api.js
│   │       └── static.js
│   └── client/
│       ├── state.js
│       ├── api.js
│       ├── rules.js
│       ├── dom.js
│       ├── render/
│       │   ├── metrics.js
│       │   ├── gpu.js
│       │   ├── requests.js
│       │   ├── sandboxes.js
│       │   ├── rotations.js
│       │   ├── evaluations.js
│       │   └── knowledge.js
│       ├── events.js
│       └── main.js
└── tests/
    ├── api.test.js
    ├── server-rules.test.js
    └── client-rules.test.js
```

说明：

- `server.js` 保留为启动入口，避免破坏 `npm start`。
- `app.js` 可保留为浏览器入口，逐步改成加载 `src/client/main.js` 或把模块合并产物放回 `app.js`。
- 如果不引入构建工具，浏览器端可以使用原生 ES modules，但必须同步修改 `index.html` 的 `<script type="module">`。
- 若担心浏览器模块迁移风险，前端第一阶段可先在 `app.js` 内部重排函数和抽离纯规则测试，第二阶段再拆文件。

## 4. 长时间自动执行总流程

Codex 应按如下循环工作：

1. 运行 `git status --short`。
2. 阅读当前阶段涉及文件，不做无关改动。
3. 先写或调整测试，再做小范围代码移动。
4. 每次只迁移一类职责，例如先迁移配置，再迁移数据库。
5. 保持旧入口兼容，让 `npm start` 仍然运行 `server.js`。
6. 每完成一个阶段，运行可用检查：
   - `npm run check`
   - `npm test`
   - 如环境不支持 Node，记录失败原因，不伪造通过。
7. 对照 README 和 `testing-deployment.md`，确认文档中的运行方式仍然成立。
8. 如果阶段中发现用户新增改动，暂停该文件的重构，先理解差异，再继续。

## 5. 分阶段执行计划

### 阶段 A：建立安全护栏

目标：在不改变功能的前提下，让后续重构有检查依据。

任务：

- 保留 `tests/api.test.js`，不要降低覆盖。
- 新增 `tests/server-rules.test.js`，优先覆盖纯业务规则：
  - 申请字段校验。
  - 评分字段校验。
  - 调度节点选择规则。
  - 端口归还排序规则。
- 新增 `tests/client-rules.test.js`，覆盖：
  - `priorityScore`。
  - `pct`。
  - 训练时长估算。
  - 进度风险判断。
- 若当前代码无法导入这些函数，先用最小改动把纯函数导出到 CommonJS 模块，前端可暂时复制纯函数到 `src/client/rules.js` 后由 `app.js` 调用。

验收：

- `npm run check` 可通过，或记录环境限制。
- `npm test` 在 Node 24+ 环境可通过。
- 页面功能不变化。

### 阶段 B：拆分后端配置与错误处理

目标：先抽离低风险公共模块。

新增或调整文件：

- `src/server/config.js`
- `src/server/errors.js`
- `src/server/http.js`

迁移内容：

- `ROOT`、`DATA_DIR`、`DB_PATH`、`PORT`、`CONTAINER_PORT`。
- `IMAGE_TEMPLATES`。
- `HttpError`。
- `json`。
- `readJson`。
- `assertText`。
- `assertNumber`。
- `nowText` 可放入 `src/server/time.js` 或 `config/http` 附近，保持简单即可。

保留要求：

- `server.js` 仍能作为唯一启动入口。
- 迁移后函数名称尽量不变，降低 diff 风险。

验收：

- `node --check server.js`
- `npm run check`
- `npm test`

### 阶段 C：拆分数据库层

目标：让数据库连接、schema、migration、seed、row mapper、repository 从 HTTP 入口分离。

新增或调整文件：

- `src/server/db/connection.js`
- `src/server/db/schema.js`
- `src/server/db/seed.js`
- `src/server/db/repositories.js`
- 可选：`src/server/db/mappers.js`

迁移内容：

- `createSchema`
- `migrateSchema`
- `seedData`
- `insertGpuNode`
- `toNode`
- `getRequests`
- `getSandboxes`
- `getRotations`
- `getEvaluations`
- `getKnowledge`
- 对应 INSERT/UPDATE/DELETE 的仓储函数。

设计要求：

- 数据库对象由 `connection.js` 创建并传入其他模块，避免隐藏全局依赖。
- 仓储函数尽量只做 SQL 和 row mapping，不混入 Docker/GPU/调度业务。
- `seedData` 必须保持幂等，不能重复插入种子数据。

验收：

- 启动后空数据库仍自动建表和写入种子数据。
- `GET /api/state` 返回字段结构与重构前一致。
- `tests/api.test.js` 通过。

### 阶段 D：拆分外部适配器

目标：隔离 Docker 和 GPU 探测，后续测试可替换。

新增或调整文件：

- `src/server/adapters/docker.js`
- `src/server/adapters/gpuMonitor.js`

迁移内容：

- Docker：
  - `runDocker`
  - `tryDocker`
  - `dockerErrorMessage`
  - `getDockerHealth`
  - `resolveDockerImage`
  - `isLightweightDemoImage`
  - `dockerCommandForImage`
  - `makeContainerName`
  - `normalizeMountPath`
  - `assertMountPath`
  - `createDockerContainer`
  - `inspectContainerStatus`
  - `pauseContainer`
  - `unpauseContainer`
  - `removeContainer`
  - `commitContainer`
- GPU：
  - `queryRealGpuNodes`
  - 与 `nvidia-smi` 输出解析相关逻辑。

设计要求：

- Docker adapter 只负责命令调用和错误转换。
- GPU adapter 只负责读取和解析 `nvidia-smi`，不要直接写数据库。
- 数据库 upsert 仍由服务或仓储层完成。

验收：

- 无 Docker 环境时 API 返回明确错误，不伪造成功。
- 无 NVIDIA GPU 时仍回退数据库种子节点。
- `/api/health` 中 `docker` 字段保持兼容。

### 阶段 E：拆分后端业务服务

目标：让每条业务链路成为清晰服务函数。

新增或调整文件：

- `src/server/services/state.js`
- `src/server/services/requests.js`
- `src/server/services/sandboxes.js`
- `src/server/services/rotations.js`
- `src/server/services/evaluations.js`

迁移内容：

- `getGpuNodes`
- `getState`
- `createRequest`
- `approveRequest`
- `rejectRequest`
- `releaseSandbox`
- `toggleSandbox`
- `snapshotSandbox`
- `progressRotation`
- `remindRotation`
- `saveEvaluation`

设计要求：

- 服务函数通过参数接收 repository 和 adapter，避免直接依赖全局对象。
- `approveRequest` 需要继续保证事务行为：
  - Docker 创建成功后再写数据库。
  - 数据库写入失败时尝试删除已创建容器。
  - request 状态、GPU 占用、端口、sandbox 记录保持一致。
- `releaseSandbox` 需要继续归还端口并排序。
- `toggleSandbox` 和 `snapshotSandbox` 需要继续写入 `last_error`。

验收：

- API 测试全部通过。
- 手动创建申请、驳回、审批、释放、推进 WBS、保存评分均可运行。

### 阶段 F：拆分路由和静态服务

目标：让 `server.js` 只负责组装依赖和启动 HTTP 服务。

新增或调整文件：

- `src/server/routes/api.js`
- `src/server/routes/static.js`
- `src/server/app.js`

迁移内容：

- `handleApi`
- `serveStatic`
- `handleRequest`
- `mimeTypes`
- URL 解析和错误响应。

设计要求：

- `createApp(dependencies)` 返回 `handleRequest`。
- `server.js` 完成：
  - 初始化配置。
  - 创建数据库连接。
  - 建表、迁移、种子数据。
  - 创建 adapters/repositories/services。
  - `http.createServer(handleRequest).listen(...)`。
- 静态文件路径必须继续防止目录穿越。

验收：

- `npm start` 输出仍包含访问地址和数据库路径。
- `GET /` 返回页面。
- `GET /api/health` 返回健康信息。
- 非法 API 返回 JSON 错误。
- 非法静态路径返回文本错误。

### 阶段 G：前端纯规则与 API 拆分

目标：先拆低风险前端模块。

新增或调整文件：

- `src/client/state.js`
- `src/client/api.js`
- `src/client/rules.js`
- `src/client/dom.js`

迁移内容：

- `state`
- `modelBaseHours`
- `roleHints`
- `escapeHtml`
- `pct`
- `priorityScore`
- 训练时长估算函数。
- API 请求函数 `apiRequest`、`loadState`、`mutate`。
- DOM 引用集中到 `dom.js`。

执行方式：

- 推荐使用浏览器原生 ES modules。
- 修改 `index.html`：
  - 将 `<script src="app.js"></script>` 改为 `<script type="module" src="src/client/main.js"></script>`。
- 保留 `app.js` 一段时间作为兼容说明或薄入口；不要立即删除。

验收：

- 浏览器控制台无模块加载错误。
- 页面初始加载、刷新资源、提交申请、搜索、筛选均正常。
- `tests/client-rules.test.js` 可直接导入规则函数。

### 阶段 H：前端渲染模块拆分

目标：把各页面区域渲染函数拆开，降低单文件维护成本。

新增或调整文件：

- `src/client/render/metrics.js`
- `src/client/render/gpu.js`
- `src/client/render/requests.js`
- `src/client/render/sandboxes.js`
- `src/client/render/rotations.js`
- `src/client/render/evaluations.js`
- `src/client/render/knowledge.js`
- `src/client/render/index.js`

迁移内容：

- `renderRoleHint`
- `renderMetrics`
- `renderGpuGrid`
- `renderRequests`
- `renderSandboxes`
- `renderRotations`
- `renderEvaluations`
- `renderKnowledge`
- `renderKnowledgeGraph`
- `renderAll`

设计要求：

- 渲染函数接收 `{ state, els }` 或明确参数，减少隐式全局依赖。
- 所有用户输入继续用 `escapeHtml`。
- 不改变页面文案和课程演示内容，除非修复明显错误。

验收：

- 所有模块区域仍能正常渲染。
- 搜索后队列、轮转卡片、知识卡片过滤正常。
- 知识图谱 SVG 仍有内容。

### 阶段 I：前端事件与入口拆分

目标：让前端入口只负责初始化。

新增或调整文件：

- `src/client/events.js`
- `src/client/main.js`

迁移内容：

- `showToast`
- `approveRequest`
- `rejectRequest`
- `autoSchedule`
- `releaseSandbox`
- `toggleSandbox`
- `snapshotSandbox`
- `progressRotation`
- `remindRotation`
- `saveEvaluation`
- `submitRequest`
- `applySearch`
- `refreshResources`
- `bindEvents`
- 初始化调用。

设计要求：

- 事件函数接收依赖，例如 `{ state, els, mutate, loadState, renderAll, showToast }`。
- 避免在模块顶层直接查询大量 DOM，统一从 `dom.js` 获取。
- 错误提示继续用 toast。

验收：

- 页面所有按钮和表单仍然工作。
- 申请提交后表单仍会 reset。
- API 错误仍显示 toast。

### 阶段 J：样式分层整理

目标：整理 `styles.css`，不改变视觉基调。

可选新增：

- 如果不引入构建工具，仍建议保留单个 `styles.css`，只在文件内部重排注释分区。
- 若决定拆 CSS 文件，需要修改 `index.html` 引入多个 CSS，但不要引入构建工具。

推荐分区：

- Design tokens
- Base
- Layout
- Sidebar
- Header
- Buttons and form controls
- Metrics
- Panels and cards
- GPU grid
- Request queue
- Sandbox table
- Rotation
- Evaluation
- Knowledge graph
- Toast
- Responsive

验收：

- 桌面和移动布局无明显错位。
- 表格仍可横向滚动。
- 颜色、字号和按钮风格保持一致。

### 阶段 K：文档同步

目标：让课程提交文档与重构后的目录结构一致。

需要更新：

- `README.md`
- `testing-deployment.md`
- `项目提交自查清单.md`
- 可选新增 `ARCHITECTURE.md`

文档应说明：

- 新目录结构。
- `server.js` 和 `src/server` 的职责。
- `src/client` 的职责。
- 运行方式仍是 `npm start`。
- 测试方式仍是 `npm test`。
- Docker/GPU/Kubernetes/GitHub 的边界不变。

验收：

- README 中没有过期的“所有逻辑在 server.js/app.js”描述。
- 部署说明中的命令仍可执行。

## 6. 推荐验收矩阵

每个阶段结束后尽量执行：

```bash
git status --short
npm run check
npm test
```

如果环境允许，再手动验收：

1. 启动 `npm start`。
2. 打开 `http://localhost:3000`。
3. 访问 `http://localhost:3000/api/health`。
4. 访问 `http://localhost:3000/api/state`。
5. 页面提交一条算力申请。
6. 驳回一条申请。
7. 如果 Docker 可用，用 `busybox-demo` 批准一条申请。
8. 对沙箱执行暂停、恢复、快照、释放。
9. 推进一个 WBS 节点。
10. 保存一次导师评分。
11. 筛选知识方向。
12. 使用顶部搜索。
13. 缩窄浏览器宽度，检查移动端布局。

## 7. 禁止操作清单

Codex 执行时不得做以下事情：

- 不得批量删除旧文件来“重建项目”。
- 不得删除 `feedback-evidence/`。
- 不得删除 `mvp-screenshot.png`、`mvp-mobile.png`。
- 不得删除任何 `.md` 课程材料。
- 不得删除 `.gitignore` 中对数据库和 `node_modules` 的忽略规则。
- 不得把 Docker 成功结果写死到测试或页面。
- 不得把 `nvidia-smi` 成功结果写死到测试或页面。
- 不得把用户联系方式伪造补全。
- 不得在没有用户批准的情况下安装大型依赖。
- 不得改变项目主题和课程作业核心链路。

## 8. 遇到问题时的处理策略

### 8.1 测试失败

先判断是环境问题还是代码问题：

- 如果是 WSL/Node 版本问题，记录原始错误，不继续声称测试通过。
- 如果是 API 返回结构变化，优先修复代码保持兼容。
- 如果是 Docker 不可用，确认错误是否明确返回给用户，而不是让服务崩溃。

### 8.2 重构过程中发现现有 bug

处理原则：

- 与当前迁移职责强相关的小 bug 可以顺手修。
- 无关功能 bug 先记录到计划或 TODO，不混入当前阶段。
- 修 bug 必须补测试或至少补手工验收说明。

### 8.3 发现用户新增改动

处理原则：

- 不回滚。
- 不覆盖。
- 阅读并理解改动意图。
- 如果与当前重构冲突，优先保留用户改动，再调整迁移方案。

## 9. 最终完成标准

完成本计划后，应满足：

- `server.js` 成为清晰启动入口，不再承载全部业务。
- 后端数据库、Docker、GPU、业务服务和路由有明确模块边界。
- 前端状态、API、规则、渲染和事件处理有明确模块边界。
- 现有课程演示链路保持可运行。
- API 测试和新增规则测试在 Node 24+ 环境通过。
- 文档准确描述新的工程结构。
- 当前目录外没有任何文件被修改。
- 没有批量删除文件。

## 10. 当前执行进度记录

截至本轮执行，已完成以下工作：

- 后端已拆分为配置、HTTP 工具、数据库 schema/seed/repository、Docker/GPU 适配器、业务服务、API 路由、静态路由和启动入口。
- 前端已拆分为状态、DOM、API、业务规则、区域渲染模块、事件绑定和组装入口，仍使用普通 `<script>` 加载，不引入构建工具。
- SQL 读写已集中到 `src/server/db/repositories.js`，服务层通过 repository 编排业务流程。
- 已新增 `ARCHITECTURE.md`，并同步更新 `README.md`、`testing-deployment.md`。
- 已新增 `tests/check-syntax.js`，让 `npm run check` 自动检查项目内 JavaScript 文件。
- 已新增规则、GPU 解析、repository、服务层编排和静态路由边界测试。
- 已收紧静态文件路由，只公开首页、前端资源、截图、课程文档和 `feedback-evidence/`，避免直接暴露后端源码、测试文件、隐藏目录和 `data/`。
- 已修复批准申请时数据库事务 `BEGIN` 失败后可能遗留 Docker 容器的资源清理边界，并补充服务层测试。
- 已新增 API handler 路由分发测试，覆盖健康检查、状态、GPU 节点、申请、沙箱、轮转、评价和 404。
- 已新增应用分发层测试，覆盖 API/静态路由分派、错误响应格式和绝对 URL API 错误处理。
- 已将应用分发层错误响应判断统一到解析后的 pathname，避免 API 错误在特殊 URL 形式下被当作普通文本响应。
- 已新增前端渲染聚合器测试，覆盖缺失渲染分片时的明确报错和 `renderAll()` 的区域调用顺序。
- 已新增前端 API 封装测试，覆盖请求头合并、错误消息、状态加载和 mutation 后刷新。
- 已新增前端事件命令层测试，并让事件模块暴露可测命令函数，覆盖自动调度、表单校验和沙箱路径编码。
- 已新增 Docker 适配器纯逻辑测试，覆盖镜像解析、命令选择、错误消息、挂载路径校验和空容器状态。
- 已新增数据库 schema/seed 契约测试，覆盖建表 SQL、sandboxes 迁移、种子数据已有时跳过和空库种子数量。
- 已新增 HTTP 工具测试，覆盖 JSON 响应、空请求体、合法 JSON、无效 JSON 400 和超大请求体 413。
- 已将 `readJson` 的解析错误改为带 HTTP 状态码的 `HttpError`，避免 API 层把客户端 JSON 错误误报为 500。
- 已将配置解析抽成可测试的 `createConfig(env, root)`，保留旧常量导出，并新增配置解析测试。
- 已新增前端状态契约测试，覆盖默认状态、`updateState` 保持 state 引用稳定和扩展字段保留。
- 已将前端 DOM 引用模块补充为可测试的 `createDom(documentRef)`，保留浏览器默认 `els`，并新增 selector 映射测试。
- 已新增前端渲染分片测试，覆盖指标渲染、集群负载状态、申请队列排序/转义、训练时长提示和全局搜索过滤。
- 已修复释放沙箱时先删除 Docker 容器再开启数据库事务的边界问题，改为事务开启成功后再删除容器，并补充 `begin()` 失败不删除容器、数据库更新失败会回滚并记录错误的服务层测试。
- 已修复 API 路由中沙箱路径参数非法百分号编码会变成 500 的问题，改为返回 `HttpError(400)`，并补充路由层测试确认不调用业务服务。
- 已修复静态路由中非法路径编码会变成普通 500 的问题，改为返回 `HttpError(400)`，并补充静态路由测试。
- 已修复前端 `apiRequest` 合并 fetch 选项时自定义 headers 覆盖默认 `Content-Type` 的问题，现有前端 API 测试覆盖该行为。
- 已扩展后端规则测试，覆盖端口归还时不重复加入已有端口，以及 GPU/显存归还计数不会降为负数。
- 已将过长的 `test:rules` 拆分为 `test:server` 和 `test:client` 两个子入口，保留 `npm run test:rules` 和 `npm test` 的总体验证语义。
- 本轮静态核查确认服务层和 `server.js` 未出现直接 `db.prepare` / `db.exec`，未生成 `.db` 文件，`git diff --check` 通过。

当前阻塞：

- 本机 WSL 1 环境没有可用 Linux `node`，`npm run check` 和 `npm test` 均返回：

```text
WSL 1 is not supported. Please upgrade to WSL 2 or above.
Could not determine Node.js install directory
```

后续继续执行时，应优先在 Node.js 24+ 可用环境中运行 `npm run check`、`npm test` 和手工页面验收，再继续拆分更细的模块。
