# Codex Web MVP (HTTP Polling + Approval Queue) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a runnable MVP in `codex-web` with GitHub login, session management, operation submit/poll, approval queue, and final full-text turn output using a host-installed `codex` CLI.

**Architecture:** Use a single Next.js app (App Router) for both API and UI. Keep one in-process runner manager per workspace (not strong isolation) that can handle multiple `thread` sessions through `codex app-server`. Persist control-plane state (`users`, `sessions`, `operations`, `approvals`) in SQLite via Prisma; the UI reads only HTTP APIs (`submit + poll`) and never relies on streaming sockets.

**Tech Stack:** Next.js 15 + TypeScript, Tailwind + shadcn/ui, TanStack Query, Prisma + SQLite, Auth.js (GitHub OAuth), Vitest + Testing Library, Playwright.

---

### Task 1: Bootstrap Workspace and Prove Test Loop

**Files:**
- Create: `package.json` (via scaffold)
- Create: `src/app/api/health/route.ts`
- Create: `vitest.config.ts`
- Create: `tests/api/health.route.test.ts`
- Modify: `package.json` scripts (`test`, `test:watch`, `typecheck`, `lint`)

**Step 1: Initialize Next.js project**

Run:

```bash
cd /Users/nantas-agent/projects/codex-web
pnpm create next-app@latest . --ts --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm --yes
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

Expected: Scaffold completes, dependencies install successfully.

**Step 2: Write the failing test**

```ts
// tests/api/health.route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns ok payload", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm vitest tests/api/health.route.test.ts -r`  
Expected: FAIL with module/file not found for `@/app/api/health/route`.

**Step 4: Write minimal implementation**

```ts
// src/app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
```

Also add minimal Vitest config:

```ts
// vitest.config.ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

**Step 5: Run tests, lint, commit**

Run:

```bash
pnpm vitest tests/api/health.route.test.ts -r
pnpm lint
```

Expected: PASS, no lint errors.

```bash
git add .
git commit -m "chore: bootstrap next app and test harness"
```

---

### Task 2: Define Shared API Contracts (YAGNI MVP Surface)

**Files:**
- Create: `src/server/contracts/api.ts`
- Create: `tests/contracts/api.contracts.test.ts`

**Step 1: Write the failing test**

```ts
// tests/contracts/api.contracts.test.ts
import { describe, expect, it } from "vitest";
import { operationStatusSchema } from "@/server/contracts/api";

describe("operationStatusSchema", () => {
  it("accepts MVP statuses", () => {
    const statuses = ["queued", "running", "waitingApproval", "completed", "failed", "interrupted"];
    for (const value of statuses) {
      expect(operationStatusSchema.parse(value)).toBe(value);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/contracts/api.contracts.test.ts -r`  
Expected: FAIL because `api.ts` does not exist.

**Step 3: Write minimal implementation**

```ts
// src/server/contracts/api.ts
import { z } from "zod";

export const operationStatusSchema = z.enum([
  "queued",
  "running",
  "waitingApproval",
  "completed",
  "failed",
  "interrupted",
]);

export const createSessionRequestSchema = z.object({
  workspaceId: z.string().min(1),
  cwd: z.string().min(1),
  model: z.string().min(1).optional(),
  resumeThreadId: z.string().min(1).nullable().optional(),
});

export const createOperationRequestSchema = z.object({
  sessionId: z.string().min(1),
  type: z.literal("turn.start"),
  input: z.array(z.object({ type: z.literal("text"), text: z.string().min(1) })).min(1),
});

export const approvalDecisionRequestSchema = z.object({
  decision: z.enum(["approve", "deny"]),
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/contracts/api.contracts.test.ts -r`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/contracts/api.ts tests/contracts/api.contracts.test.ts
git commit -m "feat: add shared mvp api contracts"
```

---

### Task 3: Add Prisma Models for Control Plane State

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Create: `src/server/db/prisma.ts`
- Create: `tests/db/prisma.schema.test.ts`

**Step 1: Write the failing test**

```ts
// tests/db/prisma.schema.test.ts
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("prisma schema", () => {
  it("can persist user/session/operation/approval minimal records", async () => {
    const prisma = new PrismaClient();
    const user = await prisma.user.create({
      data: { githubId: "1001", email: "mvp@example.com", name: "MVP User" },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        workspaceId: "ws-1",
        cwd: "/tmp/workspace",
        threadId: "thr_1",
        status: "idle",
      },
    });
    const operation = await prisma.operation.create({
      data: {
        sessionId: session.id,
        status: "queued",
        requestText: "hello",
      },
    });
    const approval = await prisma.approval.create({
      data: {
        operationId: operation.id,
        kind: "commandExecution",
        status: "pending",
        prompt: "Allow command?",
      },
    });
    expect(approval.operationId).toBe(operation.id);
    await prisma.$disconnect();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/db/prisma.schema.test.ts -r`  
Expected: FAIL because Prisma schema/client are missing.

**Step 3: Write minimal implementation**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(cuid())
  githubId  String    @unique
  email     String?
  name      String?
  createdAt DateTime  @default(now())
  sessions  Session[]
}

model Session {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspaceId String
  cwd         String
  threadId    String
  status      String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  operations  Operation[]
}

model Operation {
  id           String     @id @default(cuid())
  sessionId    String
  session      Session    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  status       String
  requestText  String
  resultText   String?
  errorMessage String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  approvals    Approval[]
}

model Approval {
  id          String    @id @default(cuid())
  operationId String
  operation   Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)
  kind        String
  status      String
  prompt      String
  decision    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

```ts
// src/server/db/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

```bash
# .env.example
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="replace_me"
GITHUB_ID="replace_me"
GITHUB_SECRET="replace_me"
```

**Step 4: Run migration + test**

Run:

```bash
cp .env.example .env
pnpm add prisma @prisma/client
pnpm prisma migrate dev --name init
pnpm vitest tests/db/prisma.schema.test.ts -r
```

Expected: Migration succeeds, test PASS.

**Step 5: Commit**

```bash
git add prisma .env.example src/server/db/prisma.ts tests/db/prisma.schema.test.ts
git commit -m "feat: add prisma sqlite schema for mvp control plane"
```

---

### Task 4: Implement Operation State Machine (Core Domain)

**Files:**
- Create: `src/server/domain/operation-state.ts`
- Create: `tests/domain/operation-state.test.ts`

**Step 1: Write the failing test**

```ts
// tests/domain/operation-state.test.ts
import { describe, expect, it } from "vitest";
import { transitionOperationState } from "@/server/domain/operation-state";

describe("transitionOperationState", () => {
  it("allows running -> waitingApproval -> running -> completed", () => {
    let state = transitionOperationState("queued", "start");
    state = transitionOperationState(state, "requireApproval");
    state = transitionOperationState(state, "approve");
    state = transitionOperationState(state, "complete");
    expect(state).toBe("completed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/domain/operation-state.test.ts -r`  
Expected: FAIL because module is missing.

**Step 3: Write minimal implementation**

```ts
// src/server/domain/operation-state.ts
export type OperationStatus =
  | "queued"
  | "running"
  | "waitingApproval"
  | "completed"
  | "failed"
  | "interrupted";

export type OperationEvent =
  | "start"
  | "requireApproval"
  | "approve"
  | "deny"
  | "complete"
  | "fail"
  | "interrupt";

export function transitionOperationState(
  current: OperationStatus,
  event: OperationEvent,
): OperationStatus {
  if (current === "queued" && event === "start") return "running";
  if (current === "running" && event === "requireApproval") return "waitingApproval";
  if (current === "waitingApproval" && event === "approve") return "running";
  if (current === "waitingApproval" && event === "deny") return "failed";
  if (current === "running" && event === "complete") return "completed";
  if (current === "running" && event === "fail") return "failed";
  if ((current === "queued" || current === "running" || current === "waitingApproval") && event === "interrupt") {
    return "interrupted";
  }
  throw new Error(`Invalid transition: ${current} -> ${event}`);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/domain/operation-state.test.ts -r`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/domain/operation-state.ts tests/domain/operation-state.test.ts
git commit -m "feat: add operation state machine"
```

---

### Task 5: Build Codex Runner Manager Abstraction (Single Process, Multi-Thread)

**Files:**
- Create: `src/server/codex/types.ts`
- Create: `src/server/codex/runner-manager.ts`
- Create: `tests/codex/runner-manager.test.ts`

**Step 1: Write the failing test**

```ts
// tests/codex/runner-manager.test.ts
import { describe, expect, it } from "vitest";
import { RunnerManager } from "@/server/codex/runner-manager";

describe("RunnerManager", () => {
  it("reuses one runner for same workspace", async () => {
    const manager = new RunnerManager();
    const first = await manager.getOrCreate("ws-1");
    const second = await manager.getOrCreate("ws-1");
    expect(second.id).toBe(first.id);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/codex/runner-manager.test.ts -r`  
Expected: FAIL because manager does not exist.

**Step 3: Write minimal implementation**

```ts
// src/server/codex/types.ts
export type RunnerHandle = {
  id: string;
  workspaceId: string;
  status: "ready" | "failed";
};
```

```ts
// src/server/codex/runner-manager.ts
import { randomUUID } from "node:crypto";
import type { RunnerHandle } from "./types";

export class RunnerManager {
  private readonly byWorkspace = new Map<string, RunnerHandle>();

  async getOrCreate(workspaceId: string): Promise<RunnerHandle> {
    const existing = this.byWorkspace.get(workspaceId);
    if (existing) return existing;
    const created: RunnerHandle = {
      id: randomUUID(),
      workspaceId,
      status: "ready",
    };
    this.byWorkspace.set(workspaceId, created);
    return created;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/codex/runner-manager.test.ts -r`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/codex tests/codex/runner-manager.test.ts
git commit -m "feat: add single-process runner manager abstraction"
```

---

### Task 6: Session + Operation Services (with Approval Pause)

**Files:**
- Create: `src/server/services/session-service.ts`
- Create: `src/server/services/operation-service.ts`
- Create: `tests/services/operation-service.test.ts`
- Modify: `src/server/db/prisma.ts` (if transaction helper needed)

**Step 1: Write the failing test**

```ts
// tests/services/operation-service.test.ts
import { describe, expect, it } from "vitest";
import { createOperationServiceForTest } from "@/server/services/operation-service";

describe("operation service", () => {
  it("moves to waitingApproval when approval is requested", async () => {
    const service = createOperationServiceForTest();
    const op = await service.createQueued({ sessionId: "ses_1", requestText: "run ls" });
    await service.markRunning(op.id);
    const approval = await service.requireApproval(op.id, {
      kind: "commandExecution",
      prompt: "Approve command?",
    });
    const polled = await service.getById(op.id);
    expect(polled?.status).toBe("waitingApproval");
    expect(approval.kind).toBe("commandExecution");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/services/operation-service.test.ts -r`  
Expected: FAIL because service file missing.

**Step 3: Write minimal implementation**

```ts
// src/server/services/operation-service.ts
import { prisma } from "@/server/db/prisma";

export function createOperationServiceForTest() {
  return new OperationService();
}

export class OperationService {
  async createQueued(input: { sessionId: string; requestText: string }) {
    return prisma.operation.create({
      data: {
        sessionId: input.sessionId,
        status: "queued",
        requestText: input.requestText,
      },
    });
  }

  async markRunning(operationId: string) {
    return prisma.operation.update({
      where: { id: operationId },
      data: { status: "running" },
    });
  }

  async requireApproval(operationId: string, input: { kind: string; prompt: string }) {
    await prisma.operation.update({
      where: { id: operationId },
      data: { status: "waitingApproval" },
    });
    return prisma.approval.create({
      data: {
        operationId,
        kind: input.kind,
        status: "pending",
        prompt: input.prompt,
      },
    });
  }

  async getById(operationId: string) {
    return prisma.operation.findUnique({ where: { id: operationId } });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/services/operation-service.test.ts -r`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/services tests/services/operation-service.test.ts
git commit -m "feat: add session and operation services with approval pause"
```

---

### Task 7: Implement HTTP API Routes (Sessions, Operations, Polling, Interrupt, Approval)

**Files:**
- Create: `src/server/http/errors.ts`
- Create: `src/server/http/auth.ts`
- Create: `src/app/api/v1/sessions/route.ts`
- Create: `src/app/api/v1/operations/route.ts`
- Create: `src/app/api/v1/operations/[operationId]/route.ts`
- Create: `src/app/api/v1/operations/[operationId]/interrupt/route.ts`
- Create: `src/app/api/v1/approvals/[approvalId]/decision/route.ts`
- Test: `tests/api/v1.routes.test.ts`

**Step 1: Write the failing test**

```ts
// tests/api/v1.routes.test.ts
import { describe, expect, it } from "vitest";
import { POST as createOperation } from "@/app/api/v1/operations/route";

describe("POST /api/v1/operations", () => {
  it("returns 202 with operationId", async () => {
    const request = new Request("http://localhost/api/v1/operations", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "ses_1",
        type: "turn.start",
        input: [{ type: "text", text: "hello" }],
      }),
      headers: { "content-type": "application/json" },
    });
    const response = await createOperation(request);
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body.operationId).toBeTruthy();
    expect(body.status).toBe("running");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/api/v1.routes.test.ts -r`  
Expected: FAIL because route missing.

**Step 3: Write minimal implementation**

Use the shared contracts in route handlers:

```ts
// src/app/api/v1/operations/route.ts
import { NextResponse } from "next/server";
import { createOperationRequestSchema } from "@/server/contracts/api";
import { OperationService } from "@/server/services/operation-service";

const service = new OperationService();

export async function POST(req: Request) {
  const payload = createOperationRequestSchema.parse(await req.json());
  const text = payload.input.map((item) => item.text).join("\n");
  const operation = await service.createQueued({
    sessionId: payload.sessionId,
    requestText: text,
  });
  await service.markRunning(operation.id);
  return NextResponse.json(
    { operationId: operation.id, status: "running", pollAfterMs: 1000 },
    { status: 202 },
  );
}
```

Apply same minimal style to the other routes.

**Step 4: Run test suite**

Run:

```bash
pnpm vitest tests/api/v1.routes.test.ts -r
pnpm vitest tests/services/operation-service.test.ts -r
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/v1 src/server/http tests/api/v1.routes.test.ts
git commit -m "feat: add mvp v1 api routes for sessions operations approvals"
```

---

### Task 8: Add GitHub OAuth via Auth.js and Protect App Routes

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`
- Create: `src/server/auth/session.ts`
- Test: `tests/auth/session.test.ts`

**Step 1: Write the failing test**

```ts
// tests/auth/session.test.ts
import { describe, expect, it } from "vitest";
import { canAccessApp } from "@/server/auth/session";

describe("canAccessApp", () => {
  it("returns false when session is missing", () => {
    expect(canAccessApp(null)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/auth/session.test.ts -r`  
Expected: FAIL because module missing.

**Step 3: Write minimal implementation**

```ts
// src/server/auth/session.ts
export function canAccessApp(session: unknown): boolean {
  return Boolean(session);
}
```

Then wire Auth.js:

```ts
// src/auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
});
```

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

```ts
// src/middleware.ts
export { auth as middleware } from "@/auth";
export const config = {
  matcher: ["/sessions/:path*", "/api/v1/:path*"],
};
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm add next-auth
pnpm vitest tests/auth/session.test.ts -r
pnpm typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/auth.ts src/app/api/auth src/middleware.ts src/server/auth/session.ts tests/auth/session.test.ts
git commit -m "feat: add github oauth and route protection baseline"
```

---

### Task 9: Build Frontend Control Console (Sessions + Session Detail + Approval Panel)

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/sessions/page.tsx`
- Create: `src/app/sessions/[sessionId]/page.tsx`
- Create: `src/components/sessions/session-list.tsx`
- Create: `src/components/sessions/session-detail-console.tsx`
- Create: `src/components/sessions/approval-card.tsx`
- Create: `src/lib/query-client.ts`
- Test: `tests/ui/session-detail-console.test.tsx`

**Step 1: Write the failing test**

```tsx
// tests/ui/session-detail-console.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionDetailConsole from "@/components/sessions/session-detail-console";

describe("SessionDetailConsole", () => {
  it("shows waiting approval badge when status is waitingApproval", () => {
    render(
      <SessionDetailConsole
        initialOperation={{ id: "op-1", status: "waitingApproval", resultText: null }}
      />,
    );
    expect(screen.getByText("Waiting Approval")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/ui/session-detail-console.test.tsx -r`  
Expected: FAIL because component file missing.

**Step 3: Write minimal implementation**

```tsx
// src/components/sessions/session-detail-console.tsx
"use client";

type Operation = {
  id: string;
  status: string;
  resultText: string | null;
};

export default function SessionDetailConsole({
  initialOperation,
}: {
  initialOperation: Operation;
}) {
  const waiting = initialOperation.status === "waitingApproval";
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Session Console</h2>
      {waiting ? (
        <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Waiting Approval</span>
      ) : null}
      {initialOperation.status === "completed" ? (
        <article className="rounded border p-3 whitespace-pre-wrap">{initialOperation.resultText}</article>
      ) : null}
    </section>
  );
}
```

**Step 4: Run test and page smoke**

Run:

```bash
pnpm vitest tests/ui/session-detail-console.test.tsx -r
pnpm dev
```

Expected: Test PASS; `/sessions` and `/sessions/[id]` pages render.

**Step 5: Commit**

```bash
git add src/app/login src/app/sessions src/components/sessions src/lib/query-client.ts tests/ui/session-detail-console.test.tsx
git commit -m "feat: add mvp console pages for sessions and approval state"
```

---

### Task 10: Add End-to-End Smoke, Docs, and Final Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/mvp-flow.spec.ts`
- Create: `README.md`
- Create: `docs/architecture/mvp-runtime.md`

**Step 1: Write failing E2E**

```ts
// tests/e2e/mvp-flow.spec.ts
import { test, expect } from "@playwright/test";

test("login -> sessions -> submit -> poll completed", async ({ page }) => {
  await page.goto("/sessions");
  await expect(page.getByText("Sessions")).toBeVisible();
});
```

**Step 2: Run to verify it fails**

Run: `pnpm exec playwright test tests/e2e/mvp-flow.spec.ts`  
Expected: FAIL until Playwright setup and app boot are complete.

**Step 3: Minimal implementation and docs**

- Add Playwright setup.
- Add `README.md` with:
  - env setup (`DATABASE_URL`, `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`)
  - run commands
  - API endpoint summary
- Add `docs/architecture/mvp-runtime.md` with:
  - single-process module map
  - operation status lifecycle
  - approval queue behavior

**Step 4: Full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright test
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/mvp-flow.spec.ts README.md docs/architecture/mvp-runtime.md
git commit -m "docs: finalize mvp verification and runtime architecture notes"
```

---

## Cross-Cutting Rules for Executor

- Keep each task DRY and YAGNI: no event streaming and no distributed queue in this MVP.
- Keep strict TDD loop: fail -> minimal pass -> refactor only when needed.
- Commit after every task.
- Use host-installed `codex` CLI for runtime integration; do not fork protocol behavior in MVP.
- When a task drifts scope, pause and add a follow-up task instead of expanding the current one.

## Suggested Command Checklist (Per Task)

```bash
pnpm lint
pnpm typecheck
pnpm test -r
```

When codex runner integration is introduced:

```bash
which codex
codex --version
```

---

## Skill References for Execution

- `@executing-plans` (required for task-by-task execution)
- `@test-driven-development` (required for red-green loop)
- `@verification-before-completion` (required before claiming task done)
- `@systematic-debugging` (required when any test is flaky/failing unexpectedly)

