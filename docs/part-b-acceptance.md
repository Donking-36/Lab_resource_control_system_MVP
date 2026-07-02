# 并行部分 B 验收说明

## 交付范围

部分 B 在 A 部分提供的鉴权、RBAC、算法报告和 Mock Docker 契约上完成前端产品化：

- 登录、会话恢复、退出和会话过期处理；
- 学生、导师、管理员三种真实角色工作台；
- 权限化按钮、所有权提示和后端 401/403 错误展示；
- 请求防重复、破坏性操作确认、全局错误与请求 ID；
- FIFO、SJF、XFS-V1 算法实验对照表；
- 移动端、键盘焦点、ARIA 与减少动画支持；
- Playwright Chromium 端到端测试。

## 答辩环境启动

```powershell
$env:LAB_SEED_TEST_USERS='1'
$env:LAB_DOCKER_MODE='mock'
npm start
```

访问 `http://localhost:3000`，测试账号：

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | `admin` | `admin-test-pass` |
| 导师 | `mentor` | `mentor-test-pass` |
| 学生 | `lin` | `lin-test-pass` |

Mock Docker 会在健康接口中明确标识 `mode: mock`，不会被描述为真实 Docker 实机结果。

## 自动验收

```powershell
npm test
npm run test:e2e
npm run verify:b
```

Playwright 使用端口 `3210`、独立数据库 `data/e2e-lab-resource.db` 和 Mock Docker。失败时在 `test-results/` 保存截图、视频与 trace；HTML 报告输出到 `playwright-report/`。

端到端覆盖：

1. 匿名访问业务 API 返回带请求 ID 的 401。
2. 错误密码可读，管理员可查看审计、调度和算法证据。
3. 学生只能提交本人申请，不能审批。
4. 导师可推进轮转与评分，不能操作容器。
5. 破坏性操作必须确认，390px 手机视口保持可用。

## 联调边界

- 前端权限仅负责减少误操作，后端 RBAC 仍是安全边界。
- 训练时长区间仍是先验估计，不宣称已用真实历史数据校准。
- Kubernetes、学校 SSO 和真实通知网关不属于本次交付。
