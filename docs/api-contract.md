# API 契约（并行部分 A → 部分 B 交接）

本文件冻结部分 A 交付的后端契约，供部分 B（前端 / E2E）对接。除新增鉴权与 `/api/algorithm/report` 外，既有业务路径保持不变。

## 鉴权与会话

- 采用本地账号 + 服务端会话。登录成功后设置 Cookie：`lab_session=<token>; HttpOnly; SameSite=Strict; Path=/`（本机 http 不带 `Secure`）。
- 会话有效期 8 小时（`LAB_SESSION_TTL_MS` 可覆盖），过期后自动失效。
- 密码使用 `scrypt` + 随机盐存储（`scrypt$N$salt$hash`），登录以 `timingSafeEqual` 比较。
- 不安全方法（POST/DELETE 等）做 Origin 校验：存在 `Origin` 头时必须与 `Host` 同源，缺省（同源/服务端调用）放行。

### 认证接口（公开）

| 方法 | 路径 | 请求体 | 响应 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{ username, password }` | `200 { user }`，并 `Set-Cookie`；失败 `401 INVALID_CREDENTIALS` |
| POST | `/api/auth/logout` | 无 | `200 { ok: true }`，清除 Cookie |
| GET | `/api/auth/me` | 无 | `200 { user }`（未登录时 `user` 为 `null`） |

`user` 结构：`{ id, username, displayName, role }`，`role ∈ { student, mentor, admin }`。

## RBAC 权限矩阵

| 路由 | student | mentor | admin |
| --- | --- | --- | --- |
| `GET /api/health` | 公开 | 公开 | 公开 |
| `GET /api/state`、`/api/gpu-nodes`、`/api/algorithm/report` | ✅（过滤） | ✅（过滤） | ✅（全量） |
| `POST /api/requests` | ✅（强制本人） | ❌ | ✅ |
| `POST /api/requests/:id/approve`、`/reject`、`POST /api/schedule/next` | ❌ | ❌ | ✅ |
| `DELETE /api/sandboxes/:id`、`POST .../toggle`、`.../snapshot` | ✅（限本人） | ❌ | ✅ |
| `POST /api/rotations/:id/progress`、`/remind`、`POST /api/evaluations` | ❌ | ✅ | ✅ |

- 匿名访问业务接口返回 `401 UNAUTHENTICATED`；角色不符返回 `403 FORBIDDEN`。
- 沙箱所有权在服务层校验：非管理员操作他人沙箱返回 `403 FORBIDDEN`。
- 学生创建申请时 `student` 被强制为当前用户 `displayName`（忽略请求体中的 `student`）。

## 错误响应

所有 `/api/*` 错误统一为：

```json
{ "error": "可读信息", "code": "MACHINE_CODE", "requestId": "uuid" }
```

常见 `code`：`BAD_REQUEST`、`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`PAYLOAD_TOO_LARGE`、`INVALID_CREDENTIALS`、`ORIGIN_MISMATCH`、`SANDBOX_STATE_INVALID`。每个响应都带 `X-Request-Id` 头，与 `requestId` 一致，便于对照结构化日志。

## `/api/state` 角色过滤

`GET /api/state` 附加 `viewer: { role, displayName }`，并按角色裁剪：

- **student**：仅本人 `requests / sandboxes / rotations / evaluations` 与相应 `scheduling.decisions`；`auditEvents` 为空。
- **mentor**：`rotations / evaluations / requests` 只读全量；`auditEvents` 为空。
- **admin**：全量，含 `auditEvents`。

其余字段（`gpuNodes / gpuMonitor / knowledge / scheduling`）对所有角色可见。

## 算法对照报告

`GET /api/algorithm/report` 返回确定性对照实验（固定种子，结果缓存）：

```jsonc
{
  "algorithmVersion": "xfs-v1",
  "weights": { "request": { "urgency": 35, ... }, "node": { ... } },
  "seed": 20240607, "trials": 30, "requestsPerTrial": 36, "totalGpu": 8,
  "starvationThresholdHours": 12,
  "metrics": { "avgWaitHours": "说明", ... },
  "results": {
    "fifo":   { "avgWaitHours": { "mean": .., "std": .. }, "p95WaitHours": {...}, "jainIndex": {...}, "gpuUtilization": {...}, "throughputPerHour": {...}, "starvationRate": {...} },
    "sjf":    { ... },
    "xfs-v1": { ... }
  }
}
```

同一数据由 `npm run simulate` 写入 `reports/algorithm/report.{json,csv,md}`（可重复生成、内容一致）。`reports/algorithm/report.md` 可直接作为对照表样例。

## 测试账号

设置 `LAB_SEED_TEST_USERS=1` 启动时创建（生产环境改用 `LAB_BOOTSTRAP_ADMIN_PASSWORD` 仅建管理员）：

| 用户名 | 密码 | 角色 | displayName |
| --- | --- | --- | --- |
| `admin` | `admin-test-pass` | admin | 系统管理员 |
| `mentor` | `mentor-test-pass` | mentor | 导师-王教授 |
| `lin` | `lin-test-pass` | student | 林可（对齐既有种子数据） |

## Mock Docker

设置 `LAB_DOCKER_MODE=mock` 时启用内存版 Docker 适配器（测试与无 Docker 答辩通用）：

- 接口与真实适配器完全一致（`createDockerContainer / pause / unpause / remove / commit / inspectContainerStatus`）。
- `GET /api/health` 的 `docker.mode` 为 `"mock"`（真实模式无该字段或调用真实 CLI）。
- 未设置该变量时仍真实调用 Docker，无 Docker 时相关操作返回真实错误，绝不伪造成功。

## 启动示例

```bash
# 无 Docker 的可答辩环境（三角色可登录）
LAB_SEED_TEST_USERS=1 LAB_DOCKER_MODE=mock PORT=3000 npm start

# 生产式启动（仅创建管理员，真实 Docker）
LAB_BOOTSTRAP_ADMIN_PASSWORD='强口令' npm start
```
