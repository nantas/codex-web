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

- `/sessions` 展示真实会话列表（状态、workspace、待审批数量、最新 operation）
- `/sessions` 基于客户端轮询自动刷新列表状态
- `/sessions/[sessionId]` 展示真实详情（最新 operation 与待审批队列）并支持审批决策交互
- `/sessions/[sessionId]` 展示 operation 历史时间线并支持分页浏览

### 3.2 API 层（Route Handlers）

- `/api/health`
- `/api/v1/sessions`
- `/api/v1/sessions/[sessionId]`
- `/api/v1/operations`
- `/api/v1/operations/[operationId]`
- `/api/v1/operations/[operationId]/logs`
- `/api/v1/operations/[operationId]/interrupt`
- `/api/v1/approvals/[approvalId]/decision`
- `/api/auth/[...nextauth]`

职责：

- 入参校验（Zod）
- 服务编排
- 错误映射
- 会话列表与详情数据聚合（latest operation / pending approvals）

### 3.3 领域与服务层

- `operation-state`：状态机规则
- `SessionService` / `OperationService`

职责：

- 管理状态迁移
- 落库与查询
- 审批触发与决策落地

### 3.4 持久化层

- Prisma schema 定义 `User/Session/Operation/Approval/OperationLog`

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

### 4.4 会话查看流程

1. `GET /api/v1/sessions` 返回会话列表与聚合摘要（latest operation、pending approvals）。
2. `/sessions` 页面以固定间隔轮询该接口，刷新会话状态与待审批数量。
3. 用户进入 `/sessions/:sessionId`。
4. `GET /api/v1/sessions/:sessionId` 返回会话详情与 operation + approval 明细。
5. 页面据此渲染会话元信息、最新执行态与审批队列，并周期刷新详情。
6. 用户在详情页点击 `approve/deny`，调用审批决策接口后立即刷新详情状态。
7. 页面按固定页大小展示 operation 历史，支持上一页/下一页切换。
8. 页面通过 operation 明细中的日志字段渲染最新日志行；也可通过 `/api/v1/operations/:id/logs` 进行 cursor 增量拉取与 `level/time-range` 过滤。
9. 会话详情页提供日志过滤控件（level/from/to），对当前分页内 operation 执行增量日志重载。
10. 过滤生效后支持 `Load New Logs` 基于最新 cursor 拉取新增日志，避免重复 `after=0` 全量查询。
11. 过滤生效后，后台轮询也切换为 cursor 增量拉取，减少重复全量详情请求。
12. 自动增量拉取失败时使用退避重试（指数增长 + 0~25% jitter，成功后恢复基础轮询间隔）。
13. 页面展示日志轮询状态面板（过滤开关、重试次数、下一次轮询间隔、每个 operation 的 cursor）。

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
- 会话页增加结构化日志过滤与搜索能力
- 权限模型细化（多用户/多租户）
- 持久化升级与备份策略
