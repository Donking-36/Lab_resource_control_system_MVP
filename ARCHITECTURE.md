# 架构说明

本文档记录当前模块化后的工程结构，便于继续维护和后续迭代。

## 入口

- `server.js`：后端启动入口，只负责组装配置、数据库、适配器、服务、路由并启动 HTTP 服务。
- `app.js`：前端启动入口，只负责连接状态、DOM、API、渲染和事件模块。
- `index.html`：页面结构和脚本加载顺序。
- `styles.css`：单文件样式，已按职责分区注释整理，暂不引入构建工具。

## 后端模块

新增的 `src/server/scheduler.js` 是纯函数算法内核：生成可解释申请排名、节点多目标匹配、等待老化分量和 Jain 公平指数。调度决策在后端执行，并随 `/api/state` 返回；`POST /api/schedule/next` 自动执行当前最高优先级且资源可满足的申请。

`audit_events` 保存应用层 append-only 审计事件。资源申请、Docker 沙箱、轮转进度和导师评分服务均在状态变更时写入结构化事件。

- `src/server/config.js`：根目录、数据库路径、端口、Docker 镜像模板，保留常量导出并提供可测试的 `createConfig()`。
- `src/server/errors.js`：HTTP 错误类型。
- `src/server/http.js`：JSON 响应、请求体读取、输入校验。
- `src/server/time.js`：统一时间文本。
- `src/server/db/`：SQLite 连接、schema、迁移、种子数据、查询映射和数据库写操作。
- `src/server/adapters/docker.js`：Docker CLI 调用、容器生命周期、镜像解析。
- `src/server/adapters/gpuMonitor.js`：`nvidia-smi` 读取与输出解析。
- `src/server/services/`：申请、沙箱、轮转、评价、全量状态等业务服务；服务层负责编排事务、校验和外部适配器调用，SQL 读写集中在 repository。
- `src/server/routes/`：API 路由和静态文件路由。
- `src/server/app.js`：HTTP 请求分发和统一错误响应。

静态文件路由只开放首页、样式、前端脚本、截图、提交文档和 `feedback-evidence/` 证据目录；后端源码、测试文件、隐藏目录和 `data/` 数据库目录不会通过网页直接暴露。

## 前端模块

- `src/client/state.js`：页面状态和状态更新函数。
- `src/client/dom.js`：集中 DOM 引用，保留默认 `els` 并提供可测试的 `createDom()`。
- `src/client/api.js`：API 请求、状态加载和 mutation 后刷新。
- `src/client/rules.js`：可测试的前端业务规则，包括优先级、百分比、训练时长和风险判断。
- `src/client/render.js`：组合各区域渲染器。
- `src/client/render/`：按页面区域拆分的渲染模块，包括指标、GPU、申请、沙箱、轮转、评价、知识图谱和输入控件。
- `src/client/events.js`：表单、按钮、搜索和刷新事件处理。

前端仍使用普通 `<script>` 加载和全局命名空间，不引入构建工具，保持课程作业部署简单。

## 测试

- `tests/api.test.js`：启动真实后端，覆盖主要 API 流程。
- `tests/config.test.js`：覆盖默认配置、环境变量覆盖和镜像模板隔离。
- `tests/server-rules.test.js`：覆盖后端纯规则和校验函数。
- `tests/http-utils.test.js`：覆盖 JSON 响应头、请求体解析、无效 JSON 400 和超大请求体 413。
- `tests/client-state.test.js`：覆盖前端默认状态、原对象引用稳定性和服务端扩展字段保留。
- `tests/client-dom.test.js`：覆盖前端 DOM selector 映射和无 `document` 环境下的安全导入。
- `tests/client-rules.test.js`：覆盖前端业务规则。
- `tests/client-api.test.js`：覆盖前端 API 请求封装、错误处理和状态刷新回调。
- `tests/client-render.test.js`：覆盖前端渲染聚合器的缺失模块检测和 `renderAll()` 调用顺序。
- `tests/client-render-parts.test.js`：覆盖指标渲染、集群状态、申请队列排序/转义、训练时长提示和全局搜索过滤。
- `tests/client-events.test.js`：覆盖前端事件命令层，包括自动调度、表单提交校验和资源操作路径。
- `tests/gpu-monitor.test.js`：覆盖 `nvidia-smi` 输出解析。
- `tests/docker-adapter.test.js`：覆盖 Docker 适配器的镜像解析、命令选择、错误消息和挂载路径校验。
- `tests/db-schema-seed.test.js`：用 fake db 覆盖建表 SQL、sandboxes 迁移和种子数据幂等/数量契约。
- `tests/repositories.test.js`：用 fake db 覆盖 repository 写操作参数和事务调用。
- `tests/server-services.test.js`：用 fake repository / Docker 适配器覆盖服务层事务编排、回滚清理、沙箱操作、轮转和状态回退。
- `tests/api-routes.test.js`：用 fake 服务覆盖 API handler 的路由分发、参数解码、非法路径编码和响应状态。
- `tests/server-app.test.js`：覆盖应用分发层的 API/静态路由分派和错误响应格式。
- `tests/static-routes.test.js`：覆盖静态文件公开路径白名单和非法路径编码错误。
- `tests/check-syntax.js`：递归收集项目内 JavaScript 文件并执行 `node --check`，避免每次新增模块后手工维护超长文件列表。

推荐验证：

```bash
npm run check
npm run test:server
npm run test:client
npm test
```

当前工作环境是 WSL 1，缺少可用 Linux `node`，Windows `node.exe` 也无法从 WSL 1 启动。若出现以下错误，应在 Node.js 24+ 可用环境中复验：

```text
WSL 1 is not supported. Please upgrade to WSL 2 or above.
Could not determine Node.js install directory
```

## 约束

- 继续保持 `npm start` 启动 `server.js`。
- 不改变现有公开 API 路径。
- 不删除课程文档、截图、用户反馈和 Docker 验收证据。
- 不提交 `data/*.db` 或 `node_modules/`。
- Docker/GPU 能力必须真实调用外部环境，不写死成功结果。
