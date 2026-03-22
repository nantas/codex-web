# MVP Runtime Architecture

## Single-Process Module Map

- `src/server/runtime/execution-config.ts`: runtime backend switch (`mock | codex`).
- `src/server/codex/codex-cli.ts`: codex executable resolution (`CODEX_BIN` override + default `codex`).
- `src/server/codex/runner-manager.ts`: in-process runner runtime manager keyed by `workspaceId`.
- `src/server/codex/app-server/client.ts`: app-server protocol client interface + noop adapter.
- `src/server/codex/app-server/process-manager.ts`: workspace-scoped app-server process manager (persistent `codex app-server` subprocess + request/response correlation).
- `src/server/codex/app-server/codex-cli-app-server-client.ts`: real app-server client adapter over process manager (modern slash protocol + legacy compatibility).
- `src/server/codex/runner-gateway.ts`: backend gateway abstraction + factory.
- `src/server/services/operation-execution-registry.ts`: in-memory operation execution references for resume/interrupt.
- `src/server/services/session-service.ts`: session creation/read logic.
- `src/server/services/operation-service.ts`: operation lifecycle orchestration (queue -> running -> terminal/waitingApproval), gateway dispatch and result writeback.
- `src/server/http/*`: route-level auth and error mapping helpers.
- `src/app/api/v1/*`: HTTP API surface used by frontend polling.

Session query endpoints used by web pages:

- `GET /api/v1/sessions`: list sessions + latest operation + pending approval count
- `GET /api/v1/sessions/:sessionId`: return session detail with operations and approvals
- `GET /api/v1/operations/:operationId/logs`: fetch operation logs with cursor (`after`), `limit`, `level`, `from`, and `to`

Current web polling behavior:

- `/sessions`: client polls `GET /api/v1/sessions` periodically to refresh list state
- `/sessions/:sessionId`: client polls `GET /api/v1/sessions/:sessionId` periodically to refresh detail state
- pending approvals can be decided in-page via `POST /api/v1/approvals/:approvalId/decision`, then detail is refreshed
- session detail page includes `Send Turn` composer, posting `turn.start` to `POST /api/v1/operations`
- session detail page renders operation history timeline with client-side paging
- operation logs are persisted in SQLite (`OperationLog`) and attached to operation detail/time-line rendering
- session detail page can trigger logs API re-fetch with `level/from/to` filters for visible operations
- session detail page tracks per-operation log cursor and supports incremental `Load New Logs`
- when filters are active, periodic polling switches to incremental logs fetch (cursor-based) instead of full detail refresh
- incremental polling applies retry backoff on failure (exponential growth capped at 30s, retry delay adds 0~25% jitter, reset after success)
- session detail UI exposes polling observability (filter state, retry count, next delay, per-operation cursor)

## Operation Status Lifecycle

Canonical statuses:

- `queued`
- `running`
- `waitingApproval`
- `completed`
- `failed`
- `interrupted`

State machine transitions are defined in `src/server/domain/operation-state.ts`.

Typical path:

1. `queued` (operation created)
2. `running` (execution starts)
3. `waitingApproval` (manual approval required)
4. `running` (approved)
5. `completed` (result finalized)

Alternative terminal states: `failed`, `interrupted`.

## Execution Backend and Fallback

- `EXECUTION_BACKEND=mock` (default): use mock gateway to keep API/UI polling behavior stable.
- `EXECUTION_BACKEND=codex`: route operation execution through `CodexAppServerGateway` (`app-server` first, `codex exec` fallback).
- Any unset/unknown backend value falls back to `mock`.
- codex backend supports per-operation timeout via `CODEX_EXEC_TIMEOUT_MS` (default `300000`).
- codex runtime command can be overridden via `CODEX_BIN` (default `codex`).
- `POST /api/v1/operations` returns `202` quickly after `startExecution`, then `OperationService.dispatchExecution` continues asynchronously.
- Approval resume threads `continuationToken` from gateway result -> execution registry -> resume call.
- Approval resume also carries operation context (`workspace/cwd/session/thread/text`) from service to gateway, so resume is robust across dev hot-reload or gateway in-memory reset.
- Interrupt uses protocol-first path (`app-server interrupt`) and falls back to process signals (`SIGINT` -> `SIGKILL`).
- app-server fallback policy is strict: only `unavailable` errors fallback to `codex exec`; protocol/execution/timeout errors are surfaced with classified failure text.
- app-server adapter now speaks real codex methods (`initialize`, `thread/start`, `turn/start`, `thread/read`, `turn/interrupt`) and keeps legacy `turn.start`/`turn.resume`/`turn.interrupt` fallback for compatibility.
- modern 审批事件识别：优先消费 `item/commandExecution/requestApproval` 通知；若通知缺失，则基于 `thread.status.activeFlags=waitingOnApproval` 兜底映射 `waitingApproval`。
- modern `thread/read` 瞬态状态（如 “thread not materialized yet”）按可重试错误处理，避免 turn 启动初期误判失败。
- modern 审批恢复优先走 server-request 原生语义：对 `requestApproval` 通知里的 `id` 回写 `result`（如 `accept`）后继续同一 turn；仅在无 modern token 时回退 legacy `turn.resume`。

## Approval Queue Behavior

When an operation requires approval:

1. Operation status updates to `waitingApproval`.
2. A new `Approval` row is persisted with `pending` status and prompt text（来自 app-server 审批通知或兜底提示）。
3. Client polls operation status and renders approval panel.
4. `POST /api/v1/approvals/:approvalId/decision` updates approval + operation state:
   - `approve` -> approval `approved`, operation `running`
   - `deny` -> approval `denied`, operation `failed`
5. On `approve`, `OperationService.resumeAfterApproval` uses cached continuation token when available.

## Persistence Model

SQLite via Prisma stores control-plane data:

- `User`
- `Session`
- `Operation`
- `Approval`
- `OperationLog`

This keeps state consistent across API polling requests in the MVP scope.
