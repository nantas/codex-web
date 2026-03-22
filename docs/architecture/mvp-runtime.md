# MVP Runtime Architecture

## Single-Process Module Map

- `src/server/codex/runner-manager.ts`: in-process runner handle manager keyed by `workspaceId`.
- `src/server/services/session-service.ts`: session creation/read logic.
- `src/server/services/operation-service.ts`: operation lifecycle persistence and approval pause handling.
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

## Approval Queue Behavior

When an operation requires approval:

1. Operation status updates to `waitingApproval`.
2. A new `Approval` row is persisted with `pending` status and prompt text.
3. Client polls operation status and renders approval panel.
4. `POST /api/v1/approvals/:approvalId/decision` updates approval + operation state:
   - `approve` -> approval `approved`, operation `running`
   - `deny` -> approval `denied`, operation `failed`

## Persistence Model

SQLite via Prisma stores control-plane data:

- `User`
- `Session`
- `Operation`
- `Approval`
- `OperationLog`

This keeps state consistent across API polling requests in the MVP scope.
