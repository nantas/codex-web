# Codex Web MVP (HTTP Polling)

Minimal self-hosted control console with:

- GitHub OAuth sign-in (Auth.js)
- Session and operation APIs
- HTTP polling operation status
- Approval decision endpoint
- Real session list/detail pages backed by database data
- Client-side polling refresh and in-page approval actions

## Quick Start (Host)

```bash
cp .env.example .env
pnpm install
pnpm prisma migrate dev
pnpm dev
```

Default runtime in this repo:

- Host/port: `0.0.0.0:43173`
- Execution backend: `mock` (default)

## Execution Backend (mock/codex)

Default behavior uses `EXECUTION_BACKEND=mock`, which keeps execution deterministic for local development and tests.

To preflight Codex CLI before enabling real execution backend:

```bash
which codex
codex --version
codex login
```

Enable codex backend when running dev server:

```bash
EXECUTION_BACKEND=codex pnpm dev
```

Optional runtime timeout for one codex execution (milliseconds):

```bash
CODEX_EXEC_TIMEOUT_MS=300000 EXECUTION_BACKEND=codex pnpm dev
```

Fallback strategy:

- If `EXECUTION_BACKEND` is unset or invalid, service falls back to `mock`.
- Keep `mock` as rollback option when codex runtime/protocol is unstable.
- Current codex backend uses workspace-resident app-server process first for turn/approval/interrupt.
- Gateway falls back to real `codex exec` only when app-server is unavailable; protocol/execution/timeout failures return classified errors instead of silent fallback.
- app-server protocol adapter now targets real codex slash methods (`initialize`, `thread/start`, `turn/start`, `thread/read`, `turn/interrupt`) and keeps legacy dot-method compatibility for older fixtures/protocols.
- Approval continuation token is threaded through service -> gateway on resume to avoid prompt replay semantics.
- `CODEX_BIN` can override codex executable path (used by deterministic integration tests and local debugging).

Optional deterministic codex integration validation (default uses fake codex fixture):

```bash
pnpm exec vitest run tests/codex/codex-app-server-gateway.integration.test.ts
```

## Required `.env` (Sanitized Template)

```env
DATABASE_URL="file:./dev.db"
APP_URL="http://<YOUR_TAILSCALE_HOST>:43173"
NEXTAUTH_URL="http://<YOUR_TAILSCALE_HOST>:43173"
NEXTAUTH_SECRET="<RANDOM_32B_PLUS_SECRET>"
GITHUB_ID="<YOUR_GITHUB_CLIENT_ID>"
GITHUB_SECRET="<YOUR_GITHUB_CLIENT_SECRET>"
```

Generate `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

## Remote Access

From another machine in the same tailnet:

- `http://<YOUR_TAILSCALE_HOST>:43173/sessions`
- `http://<YOUR_TAILSCALE_HOST>:43173/api/health`

`/sessions` renders real session records and auto-refreshes by polling.
`/sessions/[sessionId]` shows live detail, pending approvals, and supports in-page `approve/deny` decisions.
`/sessions/[sessionId]` also includes operation history timeline with paging.
`/sessions/[sessionId]` supports in-page turn submission (`Send Turn`) which calls `POST /api/v1/operations`.
operation history cards include log lines persisted in SQLite (`OperationLog`) and retained across restarts.
`/api/v1/operations/:operationId/logs` supports `after/limit/level/from/to` query params for incremental log fetching.
session detail now provides log filter controls (`level/from/to`) that call the logs API for visible history items.
after applying filter, `Load New Logs` uses cursor-based incremental fetch (`after=<lastCursor>`) instead of full reload.
when filter is active, background polling also follows cursor-based incremental log loading.
auto incremental polling now uses retry backoff with jitter on failures (exponential growth up to 30s, plus 0~25% jitter on retries, reset on success).
session detail exposes a log polling status panel (filter active, retry count, next delay, per-operation cursor).

## Manual Verification (Web Turn Flow)

Mock backend (recommended for deterministic web flow):

```bash
NEXTAUTH_SECRET=dev-secret DATABASE_URL="file:./dev.db" EXECUTION_BACKEND=mock pnpm dev
```

Then:

1. Create a session: `curl -s -X POST http://localhost:43173/api/v1/sessions -H 'content-type: application/json' -d '{"workspaceId":"ws-manual","cwd":"/tmp/ws-manual"}'`
2. Open `/sessions/<sessionId>` from response payload.
3. In `Send Turn`, input text and click `Send`.
4. Confirm new operation appears in history and status progresses (`running -> completed` in mock).
5. If operation requests approval, verify `Approve/Deny` still works.

Real codex backend quick check (API + web):

```bash
NEXTAUTH_SECRET=dev-secret EXECUTION_BACKEND=codex DATABASE_URL="file:./dev.db" pnpm dev
```

Then:

1. `curl -s -X POST http://localhost:43173/api/v1/sessions -H 'content-type: application/json' -H 'x-github-id: dev-manual' -d '{"workspaceId":"ws-real","cwd":"<ABS_WORKSPACE_PATH>"}'`
2. `curl -s -X POST http://localhost:43173/api/v1/operations -H 'content-type: application/json' -H 'x-github-id: dev-manual' -d '{"sessionId":"<sessionId>","type":"turn.start","input":[{"type":"text","text":"Reply with exactly: MANUAL_OK"}]}'`
3. Poll `GET /api/v1/operations/<operationId>` until terminal status and confirm `resultText`.
4. Open `http://localhost:43173/sessions/<sessionId>` and validate `Send Turn` end-to-end in page.

Note (Next.js 16 dev mode): prefer `localhost` over `127.0.0.1` for manual web verification to avoid dev-resource cross-origin restrictions affecting HMR/hydration.

## Start OAuth Sign-In

Use either:

- Direct URL: `http://<YOUR_TAILSCALE_HOST>:43173/api/auth/signin?callbackUrl=%2Fsessions`
- Helper command: `pnpm oauth:github`

`pnpm oauth:github` opens a browser on the machine where it is executed.

## Test Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Canonical Task / Handoff Paths

- Task discovery entry: `docs/plans/README.md`
- Handoff entry: `docs/handoff/current-handoff.md`
- Progress writeback entry: `docs/progress/project-progress.md`
- Historical plan docs under `docs/plans/*.md` are read-only unless explicitly requested.

## Full Guide

See:

- `docs/plans/README.md`
- `docs/handoff/current-handoff.md`
- `docs/guides/host-remote-access-and-auth.md`
- `docs/architecture/tech-stack-overview.md`
- `docs/architecture/solution-design-overview.md`
- `docs/progress/project-progress.md`
