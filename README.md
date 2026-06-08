# 实验室资源与轮转进度管理系统 MVP

这是根据项目文档落地的 MVP，用于演示 AI 科研实验室中“算力资源分配”和“轮转进度管理”的核心闭环。当前版本包含静态前端、Node 后端、SQLite 数据库，以及基于 `nvidia-smi` 的真实 GPU 监控接口。

> 当前系统是 MVP 工程版：申请、沙箱记录、轮转进度、导师评分和知识条目已持久化到 SQLite；GPU 大盘会优先读取本机或服务器的 `nvidia-smi`。Docker/Kubernetes 真实容器编排、登录权限和 GitHub 自动归档仍是后续接入项。

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

如需启用真实容器编排，还需要服务器安装 Docker，并确保 `docker` 命令可用。GPU 容器还需要 NVIDIA Container Toolkit。

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

## 后续接入点

- 日志与代码归档可对接 GitHub API，并把知识条目持久化到数据库。
- 训练时长预测可替换为基于历史任务的回归模型。
- 用户登录与权限可接入学校统一身份认证或实验室账号体系。
