# Host Service and Remote Access with GitHub OAuth

This document describes a complete self-hosted flow for:

- running the Codex Web service on a host machine,
- accessing it from remote clients over Tailscale,
- using GitHub OAuth (Auth.js / NextAuth) for sign-in.

All examples are sanitized. Replace placeholders with your own values.

## 1. Architecture

- Host machine runs the Next.js service on a fixed port (default in this repo: `43173`).
- Remote clients access the host through a Tailscale DNS name.
- Authentication is delegated to GitHub OAuth.
- Session cookies are browser-local. Each browser/device signs in independently.

## 2. Prerequisites

- Node.js 24+
- pnpm 10+
- Tailscale installed and connected on host and client devices
- A GitHub account with permission to create OAuth Apps

## 3. Create a GitHub OAuth App (Self-Built)

Open GitHub:

- `Settings` -> `Developer settings` -> `OAuth Apps` -> `New OAuth App`

Use values like:

- `Application name`: `codex-web-selfhost`
- `Homepage URL`: `http://<YOUR_TAILSCALE_HOST>:43173`
- `Authorization callback URL`: `http://<YOUR_TAILSCALE_HOST>:43173/api/auth/callback/github`

After creation:

- Copy `Client ID` -> `GITHUB_ID`
- Generate and copy `Client Secret` -> `GITHUB_SECRET`

Important:

- Callback URL must match your configured app URL and port.
- Never commit client secrets to git.

## 4. Configure Environment Variables

Create local env file:

```bash
cp .env.example .env
```

Set `.env`:

```env
DATABASE_URL="file:./dev.db"
APP_URL="http://<YOUR_TAILSCALE_HOST>:43173"
NEXTAUTH_URL="http://<YOUR_TAILSCALE_HOST>:43173"
NEXTAUTH_SECRET="<RANDOM_32B_PLUS_SECRET>"
GITHUB_ID="<YOUR_GITHUB_CLIENT_ID>"
GITHUB_SECRET="<YOUR_GITHUB_CLIENT_SECRET>"
```

Generate `NEXTAUTH_SECRET` safely:

```bash
openssl rand -base64 32
```

## 5. Start Host Service

On host machine:

```bash
pnpm install
pnpm prisma migrate dev
pnpm dev
```

This repo is configured to run on:

- `0.0.0.0:43173`

## 6. Remote Access Flow (Tailscale)

On any remote client in the same tailnet:

- Open `http://<YOUR_TAILSCALE_HOST>:43173/sessions`
- If not authenticated, go to sign-in page.

Health check URL:

- `http://<YOUR_TAILSCALE_HOST>:43173/api/health`

## 7. Authentication Flow

Two valid ways to start sign-in:

1. Browser direct:
- Open `http://<YOUR_TAILSCALE_HOST>:43173/api/auth/signin?callbackUrl=%2Fsessions`

2. Helper command (opens browser on the machine where command runs):

```bash
pnpm oauth:github
```

Notes:

- `pnpm oauth:github` is only a convenience launcher.
- If you run it on the host, it opens host's browser context.
- Remote users can sign in directly with the URL above from their own browser.

## 8. Validation Checklist

- `GET /api/health` returns `{"status":"ok"}` from local and remote devices.
- Sign-in page loads without `Server error`.
- Clicking `Sign in with GitHub` redirects to GitHub and back to `/sessions`.
- `/sessions` is visible after callback.

## 9. Common Issues

- `Server error / configuration` on sign-in:
  - Check `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`.
  - Check callback URL in GitHub OAuth app exactly matches runtime URL.
- `redirect_uri_mismatch` from GitHub:
  - Callback URL mismatch between GitHub app and `.env` URL/port.
- Remote access timeout:
  - Verify Tailscale connectivity and host service is running.

## 10. Security Notes

- Treat `.env` as sensitive.
- Rotate `GITHUB_SECRET` if leaked.
- Rotate `NEXTAUTH_SECRET` if leaked.
- Prefer HTTPS/reverse-proxy for internet-exposed deployments.
