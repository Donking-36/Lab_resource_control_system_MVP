# 测试与部署说明

## 1. 系统形态

当前 MVP 是前后端一体的轻量工程版，包含以下文件：

- `index.html`：页面结构和功能入口。
- `styles.css`：响应式布局和视觉样式。
- `app.js`：前端渲染、交互逻辑和后端 API 调用。
- `server.js`：Node HTTP 后端、SQLite 数据库读写、静态文件托管和 `nvidia-smi` GPU 监控。
- `package.json`：启动脚本和 Node 版本要求。
- `mvp-screenshot.png`、`mvp-mobile.png`：桌面端和移动端预览图。

当前版本不需要安装第三方依赖。数据库使用 Node 24 内置 `node:sqlite`，启动时自动生成 `data/lab_resource.db`。GPU 状态优先调用本机或服务器的 `nvidia-smi`，失败时回退到数据库种子节点。

真实容器编排需要额外安装 Docker。GPU 容器需要 NVIDIA 驱动和 NVIDIA Container Toolkit。

## 2. 本地运行

在仓库目录执行：

```powershell
npm start
```

然后访问：

```text
http://localhost:3000
```

可选端口：

```powershell
$env:PORT=3130; npm start
```

## 3. 手工验收用例

| 用例 | 操作 | 期望结果 |
| --- | --- | --- |
| T1 页面加载 | 启动 `npm start` 并打开 `http://localhost:3000` | 页面展示总览、GPU 大盘、申请、沙箱、轮转、知识图谱等模块 |
| T2 GPU 大盘 | 查看 GPU 卡片 | 能看到真实 `nvidia-smi` GPU 或数据库回退节点、显存占用、空闲端口和挂载目录 |
| T3 训练预测 | 修改模型类型、数据量、epoch | 预计训练时长随输入变化，超过阈值时出现拆分建议 |
| T4 申请提交 | 填写并提交算力申请 | 新申请写入 SQLite，并进入信用调度队列 |
| T5 信用调度 | 点击自动调度或批准分配 | 后端生成沙箱记录，队列数量减少，资源占用更新 |
| T6 沙箱操作 | 点击暂停、恢复、快照、释放 | Docker 容器状态、快照镜像和数据库记录同步更新；未安装 Docker 时显示明确错误 |
| T7 WBS 进度 | 点击推进节点 | 当前学生的阶段进度写入 SQLite，最近更新时间归零 |
| T8 风险提醒 | 查看长时间占用 GPU 且未更新的学生 | 展示“触发提醒”标记 |
| T9 导师评分 | 调整评分滑块并保存 | 评分列表更新综合分，刷新后仍保留 |
| T10 知识图谱 | 切换研究方向筛选 | 图谱和经验列表只展示对应方向 |
| T11 搜索 | 在顶部搜索学生、课题或方向 | 队列、进度和知识卡片按关键词过滤 |
| T12 响应式 | 在移动端宽度打开页面 | 导航和内容变为单列或双列布局，无明显横向遮挡 |
| T13 角色视角 | 切换导师、轮转生、管理员 | 侧边栏展示对应角色关注点，帮助试用者理解演示视角 |

## 4. 已执行检查

已执行 JavaScript 语法检查：

```powershell
node --check server.js
node --check app.js
```

结果：通过，无语法错误。

已执行后端接口检查：

```powershell
Invoke-RestMethod http://localhost:3133/api/state
```

结果：接口返回 GPU 节点、申请、沙箱、轮转、评分和知识条目；在当前机器上识别到 `nvidia-smi` 来源的 NVIDIA GPU。

当前环境未检测到 Docker CLI，因此真实容器创建需要在安装 Docker 的服务器上执行以下验收：

```powershell
docker --version
docker info
docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi
```

当前还完成了人工代码走查：确认 MVP 页面已显式标注工程边界，沙箱快照版本可见，信用调度说明已补充，用户输入在列表渲染前会进行 HTML 转义。

## 5. 静态部署

本项目现在需要 Node 后端，不再适合只部署到纯静态托管服务。可部署到以下环境：

- 安装了 Node 24+ 的实验室服务器。
- 能运行 `nvidia-smi` 的 GPU 节点或监控代理服务器。
- 校内虚拟机或云服务器。

部署步骤：

1. 将仓库文件上传到服务器。
2. 确认 Node.js 版本为 24 或更高。
3. 在仓库目录执行 `npm start`。
4. 访问 `http://服务器地址:3000`。
5. 如需后台运行，可用系统服务、PM2 或学校服务器提供的进程管理工具托管 `node server.js`。

## 6. API 说明

- `GET /api/health`：后端健康检查。
- `GET /api/state`：一次性返回页面所需全部数据。
- `GET /api/gpu-nodes`：刷新 GPU 监控数据。
- `POST /api/requests`：创建算力申请。
- `POST /api/requests/:id/approve`：批准申请并生成沙箱记录。
- `POST /api/requests/:id/reject`：驳回申请。
- `POST /api/sandboxes/:id/toggle`：暂停或恢复沙箱记录。
- `POST /api/sandboxes/:id/snapshot`：增加快照版本。
- `DELETE /api/sandboxes/:id`：释放沙箱记录和端口。
- `POST /api/rotations/:id/progress`：推进 WBS 节点。
- `POST /api/rotations/:id/remind`：记录进度提醒。
- `POST /api/evaluations`：保存导师评分。

## 7. MVP 演示边界

以下能力在当前版本中已经是真实工程能力：

- Node 后端 API。
- SQLite 数据库持久化。
- `nvidia-smi` GPU 状态读取。
- 申请、审批、沙箱记录、WBS 进度、评分和知识条目的持久化读写。
- Docker CLI 容器创建、暂停、恢复、快照、释放调用。

以下能力仍是 MVP 演示或规则模拟：

- 训练时长预测。
- 信用分生成和调度排序。
- WBS 进度提醒尚未接入真实消息通知。
- 知识图谱展示使用数据库样例，尚未接入 GitHub 自动归档。

以下能力尚未实现：

- 登录和权限控制。
- Kubernetes 集群编排。
- GitHub 自动归档。
- 自动化测试和 CI。

## 8. 后续工程化测试计划

接入后端后，建议补充：

- 单元测试：覆盖优先级计算、训练时长预测、风险提醒规则。
- API 测试：覆盖申请、审批、沙箱、评分、知识条目的增删改查。
- 端到端测试：覆盖学生申请、导师审批、管理员释放资源的完整流程。
- 集成测试：在测试服务器验证 Docker/Kubernetes 创建、端口映射和数据集挂载。
- 权限测试：验证学生、导师、管理员不能越权操作。
