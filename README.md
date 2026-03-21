# Codex Web MVP (HTTP Polling)

Minimal self-hosted control console with:

- GitHub OAuth sign-in (Auth.js)
- Session and operation APIs
- HTTP polling operation status
- Approval decision endpoint

## Quick Start (Host)

```bash
cp .env.example .env
pnpm install
pnpm prisma migrate dev
pnpm dev
```

Default runtime in this repo:

- Host/port: `0.0.0.0:43173`

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
