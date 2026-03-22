# 项目进度（Codex Web MVP）

更新时间：2026-03-22（Codex CLI 执行链路 Phase 1 第十六批已完成）

## 1. 总体状态

- 阶段：MVP 已完成（可运行、可登录、可轮询、可审批）
- 当前分支：`main`
- 状态：进入“真实执行链路接入”前的控制面增强阶段

## 2. 本次更新（2026-03-22）

- 改动摘要：
  - 第一批（已完成）：新增会话列表/详情查询接口，并将 `/sessions` 与 `/sessions/[sessionId]` 切换为真实数据库数据展示。
  - 第二批（已完成）：`/sessions` 增加客户端短轮询自动刷新；`/sessions/[sessionId]` 增加客户端短轮询与审批 `approve/deny` 交互。
  - 第三批（已完成）：`/sessions/[sessionId]` 新增 operation 历史时间线与分页浏览（上一页/下一页）。
  - 第四批（已完成）：新增 operation 日志流能力（in-process store + logs API），并将日志行接入详情时间线展示。
  - 第五批（本次完成）：将 operation 日志从 in-process 升级为 Prisma 持久化模型 `OperationLog`，支持重启后日志恢复。
  - 第六批（已完成）：为 `GET /api/v1/operations/:operationId/logs` 增加 `level/from/to` 过滤参数，并加入非法参数校验。
  - 第七批（已完成）：会话详情页接入日志过滤 UI（level/from/to）并调用 logs API 对当前分页 operation 执行日志重载。
  - 第八批（已完成）：会话详情页新增 `Load New Logs`，基于每个 operation 的 cursor 增量拉取日志，避免每次 `after=0` 全量重查。
  - 第九批（已完成）：过滤生效后，详情页后台轮询自动切换为 cursor 增量日志拉取（保留过滤上下文）。
  - 第十批（已完成）：自动增量日志轮询加入失败重试退避（指数增长，最大 30s，成功后恢复基础间隔）。
  - 第十一批（本次完成）：详情页新增日志轮询可观测状态面板，展示过滤状态、重试次数、下一次轮询间隔及 operation cursor。
  - 第十二批（本次完成）：会话详情页日志筛选/分页状态与 URL 查询参数双向同步（`page/level/from/to/filtered`），支持刷新后恢复上下文与链接分享排障。
  - 第十二批（本次完成）：`/sessions/[sessionId]` 读取 `searchParams` 并初始化详情页状态；`filtered=1` 时自动应用日志筛选。
  - 第十三批（本次完成）：自动增量日志轮询退避加入 jitter（重试时在指数退避基础上增加 0%~25% 抖动），降低多会话同频重试峰值。
  - 第十三批（本次完成）：新增 `log-poll-backoff` 统一计算轮询延迟，并由 `SessionDetailLive` 接入使用。
  - 第十四批（本次完成）：会话详情页区分“手动拉取日志失败”与“自动轮询失败”两类提示，分别记录并展示失败时间戳（ISO 时间）。
  - 第十四批（本次完成）：日志过滤重置/重试成功后对应失败时间提示会自动清理，避免陈旧告警残留。
  - 第十五批（本次完成）：完成 Codex CLI 真实执行链路接入的上下文收敛与需求确认，输出设计文档与实施计划文档（聚焦 workspace 常驻 app-server 模式）。
  - 第十五批（本次完成）：明确 Phase 1 目标范围（执行+审批+中断）、单机 MVP 边界、失败快速收敛与回滚策略（`mock|codex` 后端开关）。
  - 第十六批（本次完成）：新增运行时后端开关 `EXECUTION_BACKEND=mock|codex`，默认 `mock`，并接入 `RunnerGateway` 工厂（mock/codex）。
  - 第十六批（本次完成）：升级 `RunnerManager` 运行时元数据（workspace/cwd/endpoint/pid/status/lastSeenAt），新增 `OperationExecutionRegistry`，`OperationService` 接入异步执行编排（`startExecution -> dispatchExecution`）。
  - 第十六批（本次完成）：`POST /api/v1/operations` 改为异步执行路径；审批 `approve` 分支接线 `resumeAfterApproval`；中断路由接线 `interruptExecution`。
  - 第十六批（本次完成）：新增 codex app-server integration guard 测试（`RUN_CODEX_INTEGRATION` 门控，默认 skipped），并更新 README/架构文档说明 codex 预检与回退策略。
  - 新增 `pollIntervalMs` 组件参数用于稳定测试与轮询行为控制。
  - 新增 `session-detail-url-state` 解析/序列化工具，统一 URL 状态处理逻辑。
  - `OperationLogService.list` 新增 `level/time-range` 过滤能力，与 cursor 查询可组合使用。
  - 历史项展示 operation 状态、请求文本、结果/错误摘要、更新时间与日志摘要。
- 验证结果：
  - 第一批测试持续通过：`tests/api/sessions.routes.test.ts`、`tests/ui/session-list.test.tsx`、`tests/ui/session-detail-console.test.tsx`。
  - 第二批新增测试通过：`tests/api/approval-decision.route.test.ts`、`tests/ui/approval-card.test.tsx`、`tests/ui/sessions-live-view.test.tsx`、`tests/ui/session-detail-live.test.tsx`。
  - 第三批新增测试通过：`tests/ui/session-detail-live.test.tsx`（历史时间线渲染 + 分页切换用例）。
  - 第四批新增测试通过：`tests/api/operation-logs.route.test.ts`（logs API 游标返回）及 `tests/ui/session-detail-live.test.tsx`（日志渲染断言）。
  - 第五批新增测试通过：`tests/services/operation-log-service.test.ts`（持久化读写、跨实例读取、cursor 分页）。
  - 第六批新增测试通过：`tests/api/operation-logs.route.test.ts`（level/time-range 过滤、非法参数 400）与 `tests/services/operation-log-service.test.ts`（service 过滤能力）。
  - 第七批新增测试通过：`tests/ui/session-detail-live.test.tsx`（日志过滤控件交互与 logs API 请求参数断言）。
  - 第八批新增测试通过：`tests/ui/session-detail-live.test.tsx`（`Load New Logs` 使用 `after=<cursor>` 增量请求并追加日志）。
  - 第九批新增测试通过：`tests/ui/session-detail-live.test.tsx`（过滤激活后自动轮询触发 `after=<cursor>` 增量请求）。
  - 第十批新增测试通过：`tests/ui/session-detail-live.test.tsx`（自动轮询失败后退避重试并恢复）。
  - 第十一批新增测试通过：`tests/ui/session-detail-live.test.tsx`（轮询可观测面板展示与 cursor 显示）。
  - 第十二批新增测试通过：`tests/ui/session-detail-url-state.test.ts`（URL 状态解析与序列化）和 `tests/ui/session-detail-live.test.tsx`（URL 状态恢复与 URL 同步更新）。
  - 第十三批新增测试通过：`tests/ui/log-poll-backoff.test.ts`（无过滤直轮询、失败后 jitter 区间、最大退避上限）。
  - 第十四批新增测试通过：`tests/ui/session-detail-live.test.tsx`（手动/自动日志失败分层提示与时间戳显示）。
  - 第十五批文档产物：`docs/plans/2026-03-22-codex-cli-execution-chain-design.md` 与 `docs/plans/2026-03-22-codex-cli-execution-chain-implementation-plan.md`。
  - 第十六批新增测试通过：`tests/runtime/execution-config.test.ts`、`tests/codex/runner-gateway.test.ts`、`tests/services/operation-execution.service.test.ts`、`tests/api/operation-interrupt.route.test.ts`。
  - 第十六批集成守卫：`tests/codex/codex-app-server-gateway.integration.test.ts` 默认 skipped（未设置 `RUN_CODEX_INTEGRATION`）。
  - 第十六批全量验证通过：`pnpm lint`、`pnpm typecheck`、`pnpm test`（24 passed, 1 skipped）、`pnpm test:e2e`（1 passed）。
- 后续待办：
  - 按实施计划进入真实执行链路编码阶段（Protocol Spike -> startTurn -> approval/interruption）。
  - 增加 operation 历史筛选与搜索能力。
  - 增加日志失败提示的本地化时间展示与用户时区格式切换。
  - 补充 codex app-server 协议细节（线程恢复、审批事件映射、日志回写）并将 integration test 从 guard 模式推进到可稳定执行。

## 3. 里程碑完成情况

### M1 基础工程与测试基线

- 状态：完成
- 内容：Next.js 脚手架、Vitest、健康检查接口、基础脚本

### M2 控制面模型与契约

- 状态：完成
- 内容：Zod 契约、Prisma Schema、迁移、数据库访问封装

### M3 核心域能力

- 状态：完成
- 内容：Operation 状态机、RunnerManager 抽象、Session/Operation Service

### M4 API 与鉴权

- 状态：完成
- 内容：`/api/v1/*` 路由、Auth.js GitHub OAuth、路由保护

### M5 前端控制台

- 状态：完成
- 内容：`/login`、`/sessions`、`/sessions/[sessionId]`、审批展示组件

### M6 质量与交付文档

- 状态：完成
- 内容：Playwright 冒烟、运行时架构文档、Host/Remote 访问指南

### M7 远程访问与 OAuth 适配

- 状态：完成
- 内容：默认端口改为 `43173`、Tailscale URL 统一、OAuth 打开入口修复

### M8 文档治理与 Agent 协作规范

- 状态：完成
- 内容：重建 `AGENTS.md`，建立文档总索引、变更触发表、需求/修复后强制更新进度文档规则，以及“新建文档需用户确认”约束

## 4. 已解决关键问题

- OAuth 启动 URL 从错误的 provider endpoint 改为正确的 sign-in 页面入口
- 本地/远程统一 URL 与回调策略，避免回调不一致
- Vitest 与 SQLite 并发干扰问题已处理（串行文件执行）

## 5. 当前验证状态

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：通过
- `pnpm test:e2e`：通过
- 人工验证：OAuth 登录到 `/sessions` 已通过
- 文档治理验证：`AGENTS.md` 已与现有文档结构对齐并建立更新触发映射

## 6. 当前验证状态（本次更新）

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：通过（20 files, 43 tests）
- `pnpm test:e2e`：通过（1 test）

## 9. 当前验证状态（第十五批文档更新）

- 文档校验：已新增设计与执行方案文档并纳入 `docs/plans`。
- 代码行为：无新增代码实现（仅方案与进度文档更新）。

## 7. 未完成/后续工作

- 真实 Codex CLI 执行链路尚未接入（当前以 MVP 控制面为主）
- 前端会话/详情已具备自动刷新与审批即时交互，仍缺完整执行日志展示
- 生产部署（HTTPS、反向代理、监控告警）尚未标准化

## 8. 建议下一阶段（P1）

1. 接入真实执行通道与任务日志回传
2. 完成自动增量拉取下的前端缓存策略与可观测性增强（含 URL 状态同步）
3. 增加 OAuth 与关键 API 的失败场景自动化测试
4. 增加部署文档（systemd/pm2 + reverse proxy + TLS）
