# 方案设计总览（Codex Web MVP）

本文档描述当前方案的系统设计、核心流程与边界。

## 1. 目标

在单体 Next.js 应用内实现一个可运行的 MVP：

- 用户通过 GitHub OAuth 登录
- 创建会话并提交操作
- 通过 HTTP 轮询查看操作状态
- 处理审批请求（approve / deny）

## 2. 总体架构

- 单体应用：前端页面 + API 路由同仓同进程
- 数据持久化：Prisma + SQLite
- 控制流：Session / Operation / Approval 三段式
- Runner 管理：单进程内 `RunnerManager` 抽象（按 workspace 复用）

## 3. 分层设计

### 3.1 表现层（UI）

- `/login`
- `/sessions`
- `/sessions/[sessionId]`

职责：

- 展示会话与操作状态
- 呈现审批状态

### 3.2 API 层（Route Handlers）

- `/api/health`
- `/api/v1/sessions`
- `/api/v1/operations`
- `/api/v1/operations/[operationId]`
- `/api/v1/operations/[operationId]/interrupt`
- `/api/v1/approvals/[approvalId]/decision`
- `/api/auth/[...nextauth]`

职责：

- 入参校验（Zod）
- 服务编排
- 错误映射

### 3.3 领域与服务层

- `operation-state`：状态机规则
- `SessionService` / `OperationService`

职责：

- 管理状态迁移
- 落库与查询
- 审批触发与决策落地

### 3.4 持久化层

- Prisma schema 定义 `User/Session/Operation/Approval`

职责：

- 保证控制面状态可追踪、可轮询

## 4. 关键业务流程

### 4.1 登录流程

1. 客户端进入 Auth.js Sign-in 页面。
2. 用户跳转 GitHub 完成授权。
3. 回调到 `/api/auth/callback/github`。
4. 登录后访问 `/sessions`。

### 4.2 提交与轮询流程

1. `POST /api/v1/operations` 创建 `queued`。
2. 服务将状态推进至 `running`。
3. 客户端轮询 `GET /api/v1/operations/:id`。
4. 根据状态渲染运行中/审批中/完成/失败。

### 4.3 审批流程

1. 操作进入 `waitingApproval` 并生成 `Approval(pending)`。
2. 用户提交审批决定。
3. `approve` -> operation 回 `running`；`deny` -> operation 变 `failed`。

## 5. 安全与网络设计

- 鉴权依赖 GitHub OAuth，不使用 PAT 登录
- 统一使用 Tailscale 可达域名作为 OAuth 基准 URL
- 通过 `NEXTAUTH_SECRET` 保护会话签名
- `.env` 保持敏感信息，不入库

## 6. 已验证能力

- 本地与 Tailscale URL 访问 `/api/health`、`/sessions` 成功
- OAuth 启动路径修正为 `/api/auth/signin`，避免 provider endpoint 400
- 单元、集成、UI、E2E 冒烟可执行

## 7. 后续演进方向

- 接入真实 Codex CLI 执行通道
- 完整会话列表/详情数据改为真实 API 拉取
- 权限模型细化（多用户/多租户）
- 持久化升级与备份策略
