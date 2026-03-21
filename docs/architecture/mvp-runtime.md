# MVP Runtime Architecture

## Single-Process Module Map

- `src/server/codex/runner-manager.ts`: in-process runner handle manager keyed by `workspaceId`.
- `src/server/services/session-service.ts`: session creation/read logic.
- `src/server/services/operation-service.ts`: operation lifecycle persistence and approval pause handling.
- `src/server/http/*`: route-level auth and error mapping helpers.
- `src/app/api/v1/*`: HTTP API surface used by frontend polling.

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

This keeps state consistent across API polling requests in the MVP scope.
