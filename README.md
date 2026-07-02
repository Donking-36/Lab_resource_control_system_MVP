# 实验室资源与轮转进度管理系统 MVP

> 当前增强版引入 XFS-V1 可解释公平调度、Jain 公平指数、不确定性感知训练预测、结构化审计事件、精确 Docker GPU 数量约束和浏览器安全响应头。算法公式、实验方法与团队协作规范见 [高标准软件工程与算法创新说明](ENGINEERING-INNOVATION.md)。

这是根据项目文档落地的 MVP，用于演示 AI 科研实验室中“算力资源分配”和“轮转进度管理”的核心闭环。当前版本包含前端工作台、Node 后端、SQLite 数据库、基于 `nvidia-smi` 的真实 GPU 监控接口，以及基于 Docker CLI 的容器生命周期调用。

> 当前系统是可答辩工程版：申请、沙箱、轮转、评分、知识、账号、会话和审计均持久化到 SQLite；本地账号支持学生、导师、管理员 RBAC；GPU 大盘优先读取 `nvidia-smi`，容器既可调用真实 Docker，也可在答辩测试中明确使用 Mock Docker。Kubernetes、学校 SSO 和 GitHub 自动归档仍是后续项。

## MVP 范围

- GPU 算力大盘：优先展示 `nvidia-smi` 读取到的真实 GPU 状态，同时保留数据库节点用于演示调度闭环。
- 训练时长预测：按模型类型、数据量和 epoch 估算训练耗时。
- 信用调度队列：提交算力申请后写入 SQLite，并按紧急程度、信用分、GPU 数和时长排序。
- 沙箱编排：批准申请后自动生成数据库中的容器记录，分配节点和端口，支持暂停、恢复、快照、释放。
- 轮转 WBS：按学生展示阶段进度、GPU 消耗和进度风险提醒，进度更新写入 SQLite。
- 导师评价：按代码提交、算力效率、按期完成三个维度生成综合评分，并持久化保存。
- 科研知识图谱：按研究方向展示历史接力关系、典型问题、解决方案和代码分支。

## 提交材料

- [MVP 需求优先级清单](requirements-priority.md)
- [用户验证与反馈报告](validation-feedback-report.md)
- [测试与部署说明](testing-deployment.md)
- [架构说明](ARCHITECTURE.md)
- [A → B API 契约](docs/api-contract.md)
- [并行部分 B 验收说明](docs/part-b-acceptance.md)
- [后续迭代计划](后续迭代计划.md)
- [项目提交自查清单](项目提交自查清单.md)

建议提交时一并附上以下证据：

- `mvp-screenshot.png` 和 `mvp-mobile.png`：桌面端、移动端界面截图。
- `feedback-evidence/`：真实用户访谈摘要、问卷或聊天截图、试用过程截图。
- 用户反馈证据：`feedback-evidence/用户反馈原始材料-访谈摘要.md`、`feedback-evidence/用户反馈-01-*` 至 `feedback-evidence/用户反馈-03-*`，以及 `feedback-evidence/用户反馈汇总与闭环处理.md`。
- Docker 实机验收报告与截图：`feedback-evidence/Docker实机验收报告.md`、`Docker验收-01-*` 至 `Docker验收-04-*`。

## 运行方式

答辩环境推荐启用三角色测试账号和 Mock Docker：

```powershell
$env:LAB_SEED_TEST_USERS='1'
$env:LAB_DOCKER_MODE='mock'
npm start
```

然后在浏览器中打开：

```text
http://localhost:3000
```

数据库会自动生成在 `data/lab_resource.db`。需要 Node.js 24 或更高版本，因为本项目使用内置 `node:sqlite`。

如需启用真实容器编排，还需要服务器或本机安装 Docker，并确保 `docker` 命令可用。GPU 容器还需要 NVIDIA 驱动和 NVIDIA Container Toolkit。

登录账号：`admin/admin-test-pass`、`mentor/mentor-test-pass`、`lin/lin-test-pass`。生产式启动不应设置 `LAB_SEED_TEST_USERS`，而应通过 `LAB_BOOTSTRAP_ADMIN_PASSWORD` 创建管理员。

完整验证：

```powershell
npm test
npm run test:e2e
npm run verify:b
```

## 工程结构

当前代码已按职责拆分，`server.js` 保留为后端启动入口，`app.js` 保留为前端组装入口：

- `src/server/`：后端配置、HTTP 工具、数据库 schema/seed/repository、Docker 和 GPU 适配器、业务服务、API/静态路由。
- `src/client/`：前端状态、DOM 引用、API 请求、渲染、事件处理和可测试的业务规则。
- `tests/`：API 集成测试、语法检查脚本、配置解析测试、HTTP 工具测试、前端状态/DOM/API/规则/渲染聚合器/渲染分片/事件测试、Docker/GPU 适配器测试、数据库 schema/seed 测试、repository 契约测试、服务层编排测试、API/应用路由测试和静态路由边界测试。

## 当前完成状态

已完成：

- 前端 MVP 工作台：GPU 大盘、算力申请、信用队列、沙箱、轮转 WBS、导师评分、知识图谱。
- 角色化前端：真实登录会话、学生/导师/管理员权限界面、错误请求 ID、重复提交防护和确认对话框。
- 算法证据：页面展示 FIFO、SJF、XFS-V1 的确定性对照实验。
- 浏览器验收：Playwright 覆盖三角色、越权、移动端和破坏性操作确认。
- 后端 API 与 SQLite：申请、审批、沙箱、进度、评分和知识条目均可持久化。
- 真实 GPU 监控：有 NVIDIA 驱动时读取 `nvidia-smi`；无 GPU 或读取失败时使用数据库回退数据。
- Docker 编排接口：批准、暂停、恢复、快照、释放均已调用 Docker CLI，并已完成本机实机验收。
- 轻量 Docker 演示镜像：申请表可选择 `busybox-demo`，用于在普通 Docker 环境中验证容器创建、暂停、恢复、快照和释放。
- 提交文档：需求优先级、验证反馈、测试部署和证据归档说明已补充。

仍需在提交前补齐或现场演示：

- 用户反馈访谈摘要已覆盖导师、轮转学生、管理员三类角色；联系方式仍需团队补充或公开版打码说明。
- Docker 部分已完成实机截图归档；答辩时可现场复现页面批准分配和 `docker ps` 对照。
- 登录鉴权和 RBAC 已完成；答辩时分别登录三种账号展示权限边界。

## 预览

桌面端：

![桌面端预览](mvp-screenshot.png)

移动端：

![移动端预览](mvp-mobile.png)

## Docker 编排说明

当前后端已接入 Docker CLI，并已在本机完成实机验收：

- 批准申请时执行 `docker run -d` 创建容器。
- 暂停/恢复时执行 `docker pause` / `docker unpause`。
- 快照时执行 `docker commit` 生成 `lab-snapshot:*` 镜像。
- 释放时执行 `docker rm -f` 删除容器。

本机未安装 Docker 时，相关 API 会返回明确错误，不会伪造容器成功状态。当前验收中，页面创建的 `lab-rot-3` 容器已在 `docker ps` 中验证存在，页面 Docker ID、镜像、端口和运行状态均与终端输出一致。

Docker 验收材料：

- [Docker 实机验收报告](feedback-evidence/Docker实机验收报告.md)
- [手动创建、暂停、恢复截图](feedback-evidence/Docker验收-01-手动创建暂停恢复.png)
- [手动快照、释放截图](feedback-evidence/Docker验收-02-手动快照释放.png)
- [项目创建容器的 docker ps 截图](feedback-evidence/Docker验收-03-项目容器docker-ps.png)
- [项目沙箱运行截图](feedback-evidence/Docker验收-04-项目沙箱运行状态.png)

Docker 实机验收建议流程：

1. 运行 `docker --version` 和 `docker info`，截图证明 Docker 可用。
2. 启动项目并提交一条算力申请。
3. 镜像模板选择“轻量 Docker 演示（busybox）”，点击批准，截图页面中的容器 ID、端口、Docker 状态。
4. 运行 `docker ps`，截图同名容器 `lab-rot-{requestId}`。
5. 执行暂停、恢复、快照、释放，并分别截图页面状态、`docker ps` 或 `docker images` 输出。

## 后续接入点

- 用户反馈驱动的分阶段计划见 [后续迭代计划](后续迭代计划.md)。
- 日志与代码归档可对接 GitHub API，并把真实提交、报错和解决记录沉淀到知识条目。
- 训练时长预测可替换为基于历史任务的回归模型。
- 用户登录与权限可接入学校统一身份认证或实验室账号体系。
