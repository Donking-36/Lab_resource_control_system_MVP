# 实验室资源与轮转进度管理系统 MVP

这是根据项目文档落地的 MVP，用于演示 AI 科研实验室中“算力资源分配”和“轮转进度管理”的核心闭环。当前版本包含前端工作台、Node 后端、SQLite 数据库、基于 `nvidia-smi` 的真实 GPU 监控接口，以及基于 Docker CLI 的容器生命周期调用。

> 当前系统是 MVP 工程版：申请、沙箱记录、轮转进度、导师评分和知识条目已持久化到 SQLite；GPU 大盘会优先读取本机或服务器的 `nvidia-smi`；批准申请时会尝试通过 Docker 创建真实容器。若运行机器未安装 Docker，系统会返回明确错误，不会伪造容器创建成功。Kubernetes、登录权限和 GitHub 自动归档仍是后续接入项。

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

建议提交时一并附上以下证据：

- `mvp-screenshot.png` 和 `mvp-mobile.png`：桌面端、移动端界面截图。
- `feedback-evidence/`：真实用户访谈摘要、问卷或聊天截图、试用过程截图。
- Docker 实机验收截图：`docker ps`、容器创建页面、暂停/恢复、`docker images` 快照、释放后的 `docker ps -a`。

## 运行方式

先启动后端：

```powershell
npm start
```

然后在浏览器中打开：

```text
http://localhost:3000
```

数据库会自动生成在 `data/lab_resource.db`。需要 Node.js 24 或更高版本，因为本项目使用内置 `node:sqlite`。

如需启用真实容器编排，还需要服务器或本机安装 Docker，并确保 `docker` 命令可用。GPU 容器还需要 NVIDIA 驱动和 NVIDIA Container Toolkit。

## 当前完成状态

已完成：

- 前端 MVP 工作台：GPU 大盘、算力申请、信用队列、沙箱、轮转 WBS、导师评分、知识图谱。
- 后端 API 与 SQLite：申请、审批、沙箱、进度、评分和知识条目均可持久化。
- 真实 GPU 监控：有 NVIDIA 驱动时读取 `nvidia-smi`；无 GPU 或读取失败时使用数据库回退数据。
- Docker 编排接口：批准、暂停、恢复、快照、释放均已调用 Docker CLI。
- 提交文档：需求优先级、验证反馈、测试部署和证据归档说明已补充。

仍需在提交前补齐或现场演示：

- 至少 3 位真实用户的原始反馈证据，覆盖导师、轮转学生、管理员三类角色。
- 在一台已安装 Docker 的机器上完成容器创建、暂停/恢复、快照、释放的实机截图。
- 如评审要求多人权限隔离，需要说明当前仅为 MVP 演示视角，未实现登录鉴权。

## 预览

桌面端：

![桌面端预览](mvp-screenshot.png)

移动端：

![移动端预览](mvp-mobile.png)

## Docker 编排说明

当前后端已接入 Docker CLI：

- 批准申请时执行 `docker run -d` 创建容器。
- 暂停/恢复时执行 `docker pause` / `docker unpause`。
- 快照时执行 `docker commit` 生成 `lab-snapshot:*` 镜像。
- 释放时执行 `docker rm -f` 删除容器。

本机未安装 Docker 时，相关 API 会返回明确错误，不会伪造容器成功状态。

Docker 实机验收建议流程：

1. 运行 `docker --version` 和 `docker info`，截图证明 Docker 可用。
2. 启动项目并提交一条算力申请。
3. 点击批准，截图页面中的容器 ID、端口、Docker 状态。
4. 运行 `docker ps`，截图同名容器 `lab-rot-{requestId}`。
5. 执行暂停、恢复、快照、释放，并分别截图页面状态、`docker ps` 或 `docker images` 输出。

## 后续接入点

- 日志与代码归档可对接 GitHub API，并把真实提交、报错和解决记录沉淀到知识条目。
- 训练时长预测可替换为基于历史任务的回归模型。
- 用户登录与权限可接入学校统一身份认证或实验室账号体系。
