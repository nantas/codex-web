# Codex CLI 执行链路接入设计（Phase 1）

## 1. 背景与目标

当前 `codex-web` 已完成控制面 MVP（会话、操作、审批、日志、轮询、可观测），但 `operation` 的执行仍是模拟状态推进，尚未接入真实 Codex CLI 执行通道。

本设计目标是在不破坏现有 UI/API 使用方式的前提下，接入真实 Codex CLI 执行链路并完成以下闭环：

1. 真实执行：`POST /api/v1/operations` 触发真实执行并可轮询结果。
2. 真实审批：执行过程中可进入 `waitingApproval`，审批后可继续或失败收敛。
3. 真实中断：`interrupt` 可中断运行中的 operation。
4. 真实日志：执行与控制事件写入 `OperationLog` 并保持现有过滤/增量轮询能力。

## 2. 需求确认（已收敛）

### 2.1 关键决策

1. 执行模式：`workspace` 级常驻 `codex app-server`。
2. 首版范围：必须覆盖“执行 + 审批 + 中断”。
3. 运行边界：接受单机单进程 MVP，不做多实例协调。
4. 失败策略：快速失败并允许人工发起新 operation 重试。
5. `workspaceId` 语义：应用分组键（runner 复用键），不是权限系统工作区 ID。

### 2.2 非目标（Phase 1）

1. 多实例一致性/分布式任务调度。
2. 进程重启后的自动恢复与任务重放。
3. 生产级 SLO、高可用、复杂限流。

## 3. 现状与差距

### 3.1 现状

1. `OperationService` 当前仅做 DB 状态推进与日志写入。
2. `RunnerManager` 仅是 in-memory 占位结构，未管理真实进程。
3. API 与 UI 已形成稳定轮询闭环，且具备审批、日志过滤、增量拉取、退避+jitter、失败时间戳展示。

### 3.2 差距

1. 缺少真实 runner 生命周期管理。
2. 缺少执行请求 -> 状态回写 -> 审批暂停/恢复 -> 中断执行的真实链路。
3. 缺少执行失败快速收敛与可观测错误分类。

## 4. 目标架构

### 4.1 组件

1. `RunnerManager`（扩展）
- 维护 `workspaceId -> RunnerRuntime`
- `RunnerRuntime` 含：进程句柄、endpoint、状态、最近心跳、活跃 operation 集合
- 行为：懒启动、复用、健康探测、异常摘除

2. `CodexRunnerGateway`（新增）
- 统一封装 app-server 协议调用
- 对上暴露：
  - `ensureRunner(workspaceId, cwd)`
  - `startTurn({ sessionId, threadId, operationId, input })`
  - `resumeAfterApproval({ operationId, approvalId, decision })`
  - `interruptTurn({ operationId })`

3. `OperationExecutionRegistry`（新增，in-memory）
- 记录 `operationId -> executionHandle`
- 用于审批恢复与中断定位活跃执行上下文
- 进程重启丢失（Phase 1 接受），并以快速失败兜底

4. `OperationService`（扩展）
- 从“纯状态更新”升级为“状态机 + 执行编排”
- 写入结构化日志，驱动 UI 可观测

### 4.2 数据流

1. 提交 operation
- `POST /api/v1/operations` 创建 `queued`
- 调度 `startTurn` 异步执行
- 立即返回 `202`

2. 运行中事件
- 开始执行 -> `running`
- 普通输出 -> `OperationLog(info)`
- 完成 -> `completed + resultText`
- 异常 -> `failed + errorMessage`

3. 审批事件
- runner 报告需审批 -> `waitingApproval` + `Approval(pending)`
- 用户 `approve` -> 通知 runner 继续 -> `running`
- 用户 `deny` -> operation `failed`

4. 中断事件
- 用户 `interrupt` -> gateway 调用中断
- 成功：`interrupted`
- 失败：记录 error log，状态按实际结果收敛

## 5. API 与契约策略

### 5.1 对外 API

保持现有接口路径与基本语义不变：

1. `POST /api/v1/operations`
2. `GET /api/v1/operations/:operationId`
3. `POST /api/v1/approvals/:approvalId/decision`
4. `POST /api/v1/operations/:operationId/interrupt`
5. `GET /api/v1/operations/:operationId/logs`

### 5.2 兼容原则

1. 优先追加字段，不破坏既有字段语义。
2. UI 端不要求改请求模型即可完成 Phase 1 验收。

## 6. 状态机与一致性

### 6.1 状态迁移

1. `queued -> running`
2. `running -> waitingApproval`
3. `waitingApproval -> running`（approve）
4. `waitingApproval -> failed`（deny）
5. `running -> completed`
6. `running|waitingApproval -> interrupted`
7. 任何执行异常 -> `failed`

### 6.2 幂等与并发

1. 审批决策用 `(operationId, approvalId)` 幂等保护，重复提交不应导致二次恢复。
2. 中断与完成竞争时，以“先落库者为准 + 后续写日志说明冲突”。

## 7. 失败与回滚

### 7.1 失败策略

1. runner 启动失败：operation 直接 `failed`，错误入日志。
2. 执行异常：operation `failed`，保留错误堆栈摘要。
3. 审批恢复失败：保持 `waitingApproval` 或转 `failed`（按错误类型），并写明原因。

### 7.2 回滚策略

1. 引入开关：`EXECUTION_BACKEND=mock|codex`。
2. 若上线后异常，可切回 `mock`，保留控制面可用性。

## 8. 验收标准

1. 预检：`which codex`、`codex --version` 成功。
2. 真实执行链路：operation 能从提交到完成/失败，`resultText` 与日志可见。
3. 审批链路：`waitingApproval -> approve/deny` 按预期收敛。
4. 中断链路：运行中 operation 可中断并进入 `interrupted`。
5. 现有 UI 可观测能力保持可用：日志过滤/增量拉取/退避+jitter/失败时间戳。
6. 自动化检查通过：`lint`、`typecheck`、`test`、`test:e2e`。

## 9. 风险清单

1. app-server 协议细节与预期不一致。
2. 子进程泄漏或僵尸进程。
3. 长任务导致资源占用上升。
4. in-memory 执行句柄在服务重启后丢失。

对应缓解：

1. 首任务先做 Protocol Spike。
2. 增加进程退出钩子与健康探活。
3. 加入超时/中断保护。
4. 明确 Phase 1 不支持自动恢复，失败可人工重试。

## 10. 实施顺序（高层）

1. Protocol Spike 与 Gateway 抽象落位。
2. 打通真实 `startTurn` 执行与结果回写。
3. 打通审批恢复与中断。
4. 完成回归验证与文档同步。
