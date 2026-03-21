# OAuth Browser Launch Design

## Goal

Provide a command that opens the GitHub OAuth URL in the user's local browser so authentication is completed interactively in browser.

## Scope

- Add a CLI script entry: `pnpm oauth:github`
- Build OAuth sign-in URL targeting existing NextAuth route
- Open URL via OS-native launcher (macOS/Linux/Windows)
- Fallback: print URL when auto-open fails

Out of scope:

- Provider abstraction for non-GitHub OAuth
- Token-based login flow changes
- Auth.js provider changes

## Approach Options

1. Documentation-only URL: no code, weaker UX.
2. CLI one-click browser launch (chosen): best UX-to-effort ratio.
3. API endpoint for URL generation: more indirection than needed.

## Chosen Design

### Components

- `scripts/open-oauth-url.mjs`
  - Resolve base URL (`APP_URL` -> `NEXTAUTH_URL` -> `http://localhost:3000`)
  - Compose sign-in URL: `/api/auth/signin/github?callbackUrl=/sessions`
  - Launch browser with platform-aware command
  - On failure, print URL and exit non-zero

- `package.json`
  - Add script: `oauth:github`

- `tests/scripts/open-oauth-url.test.ts`
  - Test pure URL builder function behavior

### Data Flow

1. User runs `pnpm oauth:github`.
2. Script computes sign-in URL.
3. Script opens browser to sign-in URL.
4. User finishes OAuth in browser.
5. Auth.js callback redirects to `/sessions`.

### Error Handling

- Missing env: default to localhost base URL.
- Browser launcher failure: log actionable message and URL.

### Verification

- Unit test for URL generation.
- Manual run of `pnpm oauth:github` and browser redirect check.

## Success Criteria

- One command opens OAuth page in browser.
- OAuth can be completed in browser with current Auth.js setup.
- Command still provides usable URL when auto-open is unavailable.
