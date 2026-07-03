# 实验室资源与轮转进度管理系统

面向 AI 科研实验室的资源管理与轮转协作平台，覆盖“算力申请 → 公平调度 → Docker 沙箱 → 轮转推进 → 导师评价 → 知识沉淀”的完整闭环。

当前版本采用原生 HTML/CSS/JavaScript、Node.js 24、内置 `node:sqlite` 和 Docker CLI，无前端构建步骤。系统支持真实 GPU/Docker 环境，也提供明确标识的 Mock Docker 答辩模式。

算法公式、实验方法与工程规范见 [高标准软件工程与算法创新说明](ENGINEERING-INNOVATION.md)，模块边界见 [架构说明](ARCHITECTURE.md)。

## 当前版本亮点

- **三角色 RBAC**：学生、导师、管理员使用真实登录会话，并在 API、服务层和页面操作三个层面限制权限。
- **XFS-V1 可解释公平调度**：综合紧急度、信用分、等待老化、GPU·小时效率和当前资源公平性，并展示 Jain 公平指数与节点选择依据。
- **真实持久化**：申请、沙箱、轮转、评分、知识、账号、会话和结构化审计事件均保存到 SQLite。
- **双 Docker 模式**：生产/实机环境调用 Docker CLI；演示和端到端测试可使用内存 Mock Docker。
- **GPU 状态回退**：优先读取 `nvidia-smi`，不可用时回退到数据库节点，页面会明确展示数据来源。
- **安全与可恢复性**：HttpOnly 会话 Cookie、RBAC、输入校验、请求 ID、安全响应头、数据库迁移前自动备份。
- **知识图谱 UI 优化**：采用“研究方向 → 接续人 → 知识沉淀”三列分行布局，避免节点与文字重叠；长名称保留完整悬浮说明，移动端支持横向滚动。
- **自动化验证**：包含纯规则、服务、数据库、路由、前端渲染、API 集成和 Playwright 浏览器测试。

## 功能范围

| 模块 | 当前能力 |
| --- | --- |
| GPU 大盘 | 展示 GPU 利用率、显存、可用端口、挂载目录及监控来源 |
| 训练预测 | 根据模型类型、数据量和 epoch 给出耗时区间与置信度 |
| 算力申请 | 保存 GPU 数量、预计时长、紧急度、镜像和数据集挂载 |
| 公平调度 | XFS-V1 申请排序、节点匹配、自动调度、FIFO/SJF 对照报告 |
| 沙箱管理 | 创建、暂停、恢复、快照、释放 Docker 容器 |
| 轮转 WBS | 展示阶段进度、GPU 消耗、更新时间和风险提醒 |
| 导师评价 | 按代码、算力效率和按期完成度生成综合评分 |
| 知识图谱 | 按方向筛选历史接力关系、报错经验、解决方案和代码分支 |
| 审计与安全 | 结构化审计、角色授权、所有权校验、请求 ID 和确认对话框 |

## 环境要求

必需：

- Node.js 24 或更高版本（项目使用内置 `node:sqlite`）
- npm

可选：

- Docker：启用真实容器生命周期管理
- NVIDIA 驱动与 `nvidia-smi`：读取真实 GPU 状态
- NVIDIA Container Toolkit：运行 GPU Docker 容器

安装依赖：

```powershell
npm install
```

若首次运行 Playwright：

```powershell
npx playwright install chromium
```

## 快速启动

### 答辩/本地演示模式

此模式会创建三组测试账号，并使用 Mock Docker，不要求本机 Docker 正常运行：

```powershell
$env:LAB_SEED_TEST_USERS='1'
$env:LAB_DOCKER_MODE='mock'
npm start
```

浏览器访问：

```text
http://localhost:3000
```

测试账号：

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | `admin` | `admin-test-pass` |
| 导师 | `mentor` | `mentor-test-pass` |
| 学生 | `lin` | `lin-test-pass` |

> 测试账号只应在演示和自动化测试环境中启用。

### 生产式本地启动

默认 Docker 模式为 `real`。首次启动时通过环境变量创建管理员：

```powershell
$env:LAB_BOOTSTRAP_ADMIN_PASSWORD='请替换为强密码'
npm start
```

管理员创建后可在后续启动中移除该环境变量。不要在生产环境设置 `LAB_SEED_TEST_USERS`。

### 健康检查

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

返回值包含数据库路径、Docker 可用状态、运行模式和服务器时间。

## 角色权限

| 操作 | 学生 | 导师 | 管理员 |
| --- | :---: | :---: | :---: |
| 查看授权范围内的状态、GPU 和算法报告 | ✓ | ✓ | ✓ |
| 提交算力申请 | 仅本人 | — | ✓ |
| 批准、拒绝和自动调度申请 | — | — | ✓ |
| 操作沙箱 | 仅本人 | — | ✓ |
| 推进轮转与发送提醒 | — | ✓ | ✓ |
| 保存导师评分 | — | ✓ | ✓ |
| 查看完整审计数据 | — | — | ✓ |

服务层还会执行行级所有权校验，不能仅通过构造 API 请求操作其他学生的资源。

## 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 服务端口 |
| `LAB_MVP_DB` | `data/lab_resource.db` | SQLite 数据库路径 |
| `LAB_DOCKER_MODE` | `real` | `real` 或 `mock` |
| `LAB_CONTAINER_PORT` | `8888` | 容器内服务端口 |
| `LAB_SESSION_TTL_MS` | 8 小时 | 登录会话有效期（毫秒） |
| `LAB_BOOTSTRAP_ADMIN_PASSWORD` | 空 | 首次创建管理员的密码 |
| `LAB_SEED_TEST_USERS` | `0` | 设为 `1` 时创建三角色测试账号 |

PowerShell 中环境变量只对当前终端会话生效。

## 端口占用处理

若出现“端口 3000 已被占用”，先确认监听进程：

```powershell
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
$listener
if ($listener) { Get-Process -Id $listener.OwningProcess }
```

确认它是可以关闭的旧项目进程后：

```powershell
Stop-Process -Id $listener.OwningProcess
npm start
```

也可以直接换端口：

```powershell
$env:PORT='3001'
npm start
```

然后访问 `http://localhost:3001`。不要在同一端口重复运行多个 `npm start`。

## Docker 模式

### Mock 模式

```powershell
$env:LAB_DOCKER_MODE='mock'
npm start
```

Mock 适配器与真实 Docker 适配器使用相同业务接口，但只维护内存状态；健康检查会明确返回 `mode: "mock"`，不会伪装成真实 Docker。

### 真实模式

真实模式支持：

- 批准申请时执行 `docker run -d`
- 暂停/恢复时执行 `docker pause` / `docker unpause`
- 快照时执行 `docker commit`
- 释放时执行 `docker rm -f`
- `busybox-demo` 轻量镜像用于普通 Docker 环境验证
- PyTorch/TensorFlow 镜像用于具备对应 GPU 环境的实验

环境检查：

```powershell
docker --version
docker info
nvidia-smi
```

Docker 不可用时，真实模式会返回明确错误，不会伪造成功状态。实机验收过程见 [Docker 实机验收报告](feedback-evidence/Docker实机验收报告.md)。

## 知识图谱布局

知识图谱根据筛选结果动态生成：

- 顶部以“实验室资产”为根节点
- 每条知识记录独占一行
- 左列为研究方向，中列为接续人，右列为报错经验与代码分支
- 节点使用固定边界的胶囊形状，行距根据记录数量动态扩展
- 超长研究方向会省略显示，同时通过 SVG `<title>` 保留完整内容
- 窄屏下保持可读尺寸并提供横向滚动
- Playwright 会验证完整视图的 13 个节点无重叠，并验证筛选后的 5 节点视图

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动应用 |
| `npm run check` | 递归执行 JavaScript 语法检查 |
| `npm run test:server` | 后端规则、适配器、数据库、服务和路由测试 |
| `npm run test:client` | 前端状态、权限、API、渲染和事件测试 |
| `npm run test:api` | 真实 HTTP/SQLite API 集成测试 |
| `npm test` | 语法、服务端、客户端和 API 测试 |
| `npm run test:e2e` | Playwright 三角色和响应式浏览器测试 |
| `npm run simulate` | 生成 FIFO、SJF、XFS-V1 对照实验 |
| `npm run db:init` | 初始化数据库 |
| `npm run db:backup` | 手动备份数据库 |
| `npm run db:check` | 检查数据库结构和数据 |
| `npm run verify` | 执行非浏览器完整验证 |
| `npm run verify:b` | 执行 `npm test` 与端到端测试 |

每次启动若检测到已有数据库，系统会先把迁移前副本保存到 `data/backups/`。终端中的“迁移前数据库备份”是正常提示。

## API 概览

公开接口：

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

登录后主要接口：

- `GET /api/state`
- `GET /api/gpu-nodes`
- `GET /api/algorithm/report`
- `POST /api/requests`
- `POST /api/requests/:id/approve`
- `POST /api/requests/:id/reject`
- `POST /api/schedule/next`
- `POST /api/sandboxes/:id/toggle`
- `POST /api/sandboxes/:id/snapshot`
- `DELETE /api/sandboxes/:id`
- `POST /api/rotations/:id/progress`
- `POST /api/rotations/:id/remind`
- `POST /api/evaluations`

请求与响应契约见 [A → B API 契约](docs/api-contract.md)。

## 工程结构

```text
.
├─ server.js                 # 后端依赖组装与启动入口
├─ app.js                    # 前端组装入口
├─ index.html / styles.css   # 页面结构与响应式样式
├─ src/
│  ├─ server/
│  │  ├─ adapters/           # Docker、Mock Docker、GPU 监控
│  │  ├─ auth/               # 密码哈希与校验
│  │  ├─ db/                 # schema、迁移、seed、repository
│  │  ├─ routes/             # 鉴权、API、静态资源路由
│  │  ├─ services/           # 申请、沙箱、轮转、评价、状态
│  │  └─ scheduler.js        # XFS-V1 调度算法
│  └─ client/
│     ├─ render/             # 页面区域渲染器
│     ├─ api.js              # 请求与状态刷新
│     ├─ permissions.js      # 前端能力判断
│     └─ events.js           # 表单与操作事件
├─ tests/
│  └─ e2e/                   # Playwright 浏览器验收
├─ scripts/                  # 模拟、数据库和 E2E 启动脚本
├─ reports/algorithm/        # 调度算法实验报告
└─ feedback-evidence/        # 用户反馈与 Docker 验收证据
```

静态路由使用白名单，只公开页面、前端脚本、截图和指定文档；`data/`、服务端源码、测试文件和隐藏目录不会通过网页暴露。

## 验证

推荐提交前运行：

```powershell
npm test
npm run test:e2e
npm run simulate
npm run db:check
```

端到端测试使用独立数据库 `data/e2e-lab-resource.db`、端口 `3210`、测试账号和 Mock Docker，不会依赖真实 Docker。

测试范围包括：

- XFS-V1 排名、节点匹配和 Jain 公平指数
- 身份认证、会话、RBAC 与资源所有权
- Docker 真实/Mock 适配器
- SQLite schema、迁移、repository 和事务回滚
- HTTP 错误、请求 ID、安全响应头与静态文件边界
- 前端状态、渲染、事件、重复提交与错误反馈
- 三角色浏览器流程、移动端布局和知识图谱防重叠

## 项目文档

- [需求优先级清单](requirements-priority.md)
- [用户验证与反馈报告](validation-feedback-report.md)
- [测试与部署说明](testing-deployment.md)
- [架构说明](ARCHITECTURE.md)
- [工程与算法创新说明](ENGINEERING-INNOVATION.md)
- [A → B API 契约](docs/api-contract.md)
- [并行部分 B 验收说明](docs/part-b-acceptance.md)
- [后续迭代计划](后续迭代计划.md)
- [项目提交自查清单](项目提交自查清单.md)
- [用户反馈证据清单](feedback-evidence/用户反馈证据清单.md)

## 预览

桌面端：

![桌面端预览](mvp-screenshot.png)

移动端：

![移动端预览](mvp-mobile.png)

## 当前边界与后续方向

当前版本已完成本地账号、三角色 RBAC、SQLite 持久化、真实/Mock Docker、GPU 监控、可解释调度、审计和知识图谱。以下仍属于后续接入项：

- 学校 SSO 或统一身份认证
- Kubernetes/队列系统和多机容器编排
- GitHub API 自动归档真实提交、报错与解决记录
- 基于历史任务数据训练耗时回归模型
- 生产级密钥管理、HTTPS、集中日志与监控告警
