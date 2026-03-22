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
```

Enable codex backend when running dev server:

```bash
EXECUTION_BACKEND=codex pnpm dev
```

Fallback strategy:

- If `EXECUTION_BACKEND` is unset or invalid, service falls back to `mock`.
- Keep `mock` as rollback option when codex runtime/protocol is unstable.

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
operation history cards include log lines persisted in SQLite (`OperationLog`) and retained across restarts.
`/api/v1/operations/:operationId/logs` supports `after/limit/level/from/to` query params for incremental log fetching.
session detail now provides log filter controls (`level/from/to`) that call the logs API for visible history items.
after applying filter, `Load New Logs` uses cursor-based incremental fetch (`after=<lastCursor>`) instead of full reload.
when filter is active, background polling also follows cursor-based incremental log loading.
auto incremental polling now uses retry backoff with jitter on failures (exponential growth up to 30s, plus 0~25% jitter on retries, reset on success).
session detail exposes a log polling status panel (filter active, retry count, next delay, per-operation cursor).

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

## Full Guide

See:

- `docs/guides/host-remote-access-and-auth.md`
- `docs/architecture/tech-stack-overview.md`
- `docs/architecture/solution-design-overview.md`
- `docs/progress/project-progress.md`
