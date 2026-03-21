# Codex Web MVP (HTTP Polling)

A minimal control console for Codex sessions with:

- GitHub OAuth login (Auth.js)
- Session creation and lookup APIs
- Operation submit + HTTP polling status
- Approval queue decision endpoint
- Next.js App Router frontend pages for sessions and detail view

## Requirements

- Node.js 24+
- pnpm 10+

## Environment Setup

```bash
cp .env.example .env
```

Set these values in `.env`:

- `DATABASE_URL` (default: `file:./dev.db`)
- `NEXTAUTH_SECRET`
- `GITHUB_ID`
- `GITHUB_SECRET`

## Install and Database Init

```bash
pnpm install
pnpm prisma migrate dev
```

## Run

```bash
pnpm dev
```

Open `http://localhost:3000/sessions`.

Open GitHub OAuth in your local browser:

```bash
pnpm oauth:github
```

The command uses `APP_URL` first, then `NEXTAUTH_URL`, then defaults to `http://localhost:3000`.

## Test and Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

## API Endpoints (MVP)

- `GET /api/health`
- `POST /api/v1/sessions`
- `POST /api/v1/operations`
- `GET /api/v1/operations/:operationId`
- `POST /api/v1/operations/:operationId/interrupt`
- `POST /api/v1/approvals/:approvalId/decision`
- `GET|POST /api/auth/[...nextauth]`

## Notes

- This MVP uses a single-process in-app runner manager abstraction.
- UI reads backend state via HTTP polling only (no streaming sockets).
- Runtime integration assumes host-installed `codex` CLI in later phases.
