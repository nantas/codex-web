# Codex CLI Execution Chain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在保持现有 HTTP polling 控制面体验不变的前提下，接入真实 Codex CLI（workspace 常驻 app-server）执行链路，打通执行、审批恢复与中断。

**Architecture:** 在服务内引入 `CodexRunnerGateway` + 扩展 `RunnerManager` 管理 workspace 常驻 runner，再由 `OperationService` 统一编排状态机和执行事件回写。API 对外契约尽量保持兼容，UI 通过现有轮询与日志机制观察真实执行状态。

**Tech Stack:** Next.js App Router, TypeScript, Prisma + SQLite, Vitest, Playwright, host-installed `codex` CLI.

---

### Task 1: Add Execution Backend Switch and Runtime Config

**Files:**
- Create: `src/server/runtime/execution-config.ts`
- Create: `tests/runtime/execution-config.test.ts`
- Modify: `README.md`

**Step 1: Write the failing test**

```ts
// tests/runtime/execution-config.test.ts
import { describe, expect, it } from "vitest";
import { getExecutionBackend } from "@/server/runtime/execution-config";

describe("execution backend config", () => {
  it("defaults to mock", () => {
    delete process.env.EXECUTION_BACKEND;
    expect(getExecutionBackend()).toBe("mock");
  });

  it("accepts codex backend", () => {
    process.env.EXECUTION_BACKEND = "codex";
    expect(getExecutionBackend()).toBe("codex");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/runtime/execution-config.test.ts`  
Expected: FAIL with module not found for `execution-config.ts`.

**Step 3: Write minimal implementation**

```ts
// src/server/runtime/execution-config.ts
export type ExecutionBackend = "mock" | "codex";

export function getExecutionBackend(): ExecutionBackend {
  return process.env.EXECUTION_BACKEND === "codex" ? "codex" : "mock";
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/runtime/execution-config.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/runtime/execution-config.ts tests/runtime/execution-config.test.ts README.md
git commit -m "feat: add execution backend runtime switch"
```

### Task 2: Upgrade RunnerManager to Manage Workspace Runtime Metadata

**Files:**
- Modify: `src/server/codex/types.ts`
- Modify: `src/server/codex/runner-manager.ts`
- Modify: `tests/codex/runner-manager.test.ts`

**Step 1: Write the failing test**

```ts
// tests/codex/runner-manager.test.ts
import { describe, expect, it } from "vitest";
import { RunnerManager } from "@/server/codex/runner-manager";

describe("RunnerManager", () => {
  it("tracks runtime metadata per workspace", async () => {
    const manager = new RunnerManager();
    const runtime = await manager.getOrCreate("ws-1", { cwd: "/tmp/ws-1" });
    expect(runtime.workspaceId).toBe("ws-1");
    expect(runtime.cwd).toBe("/tmp/ws-1");
    expect(runtime.status).toBe("starting");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/codex/runner-manager.test.ts`  
Expected: FAIL because `getOrCreate` signature/fields do not match.

**Step 3: Write minimal implementation**

```ts
// src/server/codex/types.ts
export type RunnerRuntime = {
  id: string;
  workspaceId: string;
  cwd: string;
  endpoint: string | null;
  pid: number | null;
  status: "starting" | "ready" | "failed" | "stopped";
  lastSeenAt: string | null;
};
```

```ts
// src/server/codex/runner-manager.ts (核心片段)
async getOrCreate(workspaceId: string, input: { cwd: string }): Promise<RunnerRuntime> {
  const existing = this.byWorkspace.get(workspaceId);
  if (existing) return existing;
  const created: RunnerRuntime = {
    id: randomUUID(),
    workspaceId,
    cwd: input.cwd,
    endpoint: null,
    pid: null,
    status: "starting",
    lastSeenAt: null,
  };
  this.byWorkspace.set(workspaceId, created);
  return created;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/codex/runner-manager.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/codex/types.ts src/server/codex/runner-manager.ts tests/codex/runner-manager.test.ts
git commit -m "feat: extend runner manager runtime metadata"
```

### Task 3: Add CodexRunnerGateway Interface and Mock/Codex Implementations

**Files:**
- Create: `src/server/codex/runner-gateway.ts`
- Create: `src/server/codex/backends/mock-runner-gateway.ts`
- Create: `src/server/codex/backends/codex-app-server-gateway.ts`
- Create: `tests/codex/runner-gateway.test.ts`

**Step 1: Write the failing test**

```ts
// tests/codex/runner-gateway.test.ts
import { describe, expect, it } from "vitest";
import { createRunnerGateway } from "@/server/codex/runner-gateway";

describe("runner gateway factory", () => {
  it("returns mock gateway by default", () => {
    delete process.env.EXECUTION_BACKEND;
    const gateway = createRunnerGateway();
    expect(gateway.backend).toBe("mock");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/codex/runner-gateway.test.ts`  
Expected: FAIL with missing module.

**Step 3: Write minimal implementation**

```ts
// src/server/codex/runner-gateway.ts
export type RunnerGateway = {
  backend: "mock" | "codex";
  ensureRunner(input: { workspaceId: string; cwd: string }): Promise<void>;
  startTurn(input: { operationId: string; sessionId: string; threadId: string; text: string }): Promise<void>;
  resumeAfterApproval(input: { operationId: string; approvalId: string; decision: "approve" | "deny" }): Promise<void>;
  interruptTurn(input: { operationId: string }): Promise<void>;
};
```

实现 `createRunnerGateway()`：按 `EXECUTION_BACKEND` 返回 mock 或 codex 版本。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/codex/runner-gateway.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/codex/runner-gateway.ts src/server/codex/backends tests/codex/runner-gateway.test.ts
git commit -m "feat: add runner gateway abstraction and backend factory"
```

### Task 4: Orchestrate Real Execution Lifecycle in OperationService

**Files:**
- Modify: `src/server/services/operation-service.ts`
- Create: `src/server/services/operation-execution-registry.ts`
- Create: `tests/services/operation-execution.service.test.ts`

**Step 1: Write the failing test**

```ts
// tests/services/operation-execution.service.test.ts
import { describe, expect, it, vi } from "vitest";
import { createOperationServiceForTest } from "@/server/services/operation-service";

describe("operation execution orchestration", () => {
  it("moves queued operation to running and dispatches gateway startTurn", async () => {
    const service = createOperationServiceForTest();
    const spy = vi.spyOn(service, "dispatchExecution");
    const op = await service.createQueued({ sessionId: "ses_test", requestText: "echo hi" });
    await service.startExecution(op.id);
    expect(spy).toHaveBeenCalledWith(op.id);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/services/operation-execution.service.test.ts`  
Expected: FAIL because new methods are absent.

**Step 3: Write minimal implementation**

新增方法（示例）：

1. `startExecution(operationId)`：标记 `running`，异步调用 gateway。
2. `dispatchExecution(operationId)`：确保 runner，调用 `startTurn`，根据回执写 `completed/failed/waitingApproval`。
3. 维护 `OperationExecutionRegistry` 以支持审批恢复和中断关联。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/services/operation-execution.service.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/services/operation-service.ts src/server/services/operation-execution-registry.ts tests/services/operation-execution.service.test.ts
git commit -m "feat: orchestrate operation execution lifecycle via runner gateway"
```

### Task 5: Wire POST /operations to Async Real Execution Path

**Files:**
- Modify: `src/app/api/v1/operations/route.ts`
- Modify: `tests/api/v1.routes.test.ts`

**Step 1: Write the failing test**

在 `tests/api/v1.routes.test.ts` 新增断言：创建 operation 后，状态先进入 `running`，并在后续可由 service/gateway 回写最终态（可用 mock backend 立刻完成）。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/api/v1.routes.test.ts`  
Expected: FAIL due missing asynchronous dispatch path.

**Step 3: Write minimal implementation**

在路由中：

1. `createQueued`
2. `startExecution(operation.id)`（非阻塞触发）
3. 返回 `202`（保持兼容）

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/api/v1.routes.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/v1/operations/route.ts tests/api/v1.routes.test.ts
git commit -m "feat: route operations submit through async execution service"
```

### Task 6: Wire Approval Resume and Interrupt to Runner Gateway

**Files:**
- Modify: `src/app/api/v1/approvals/[approvalId]/decision/route.ts`
- Modify: `src/app/api/v1/operations/[operationId]/interrupt/route.ts`
- Modify: `tests/api/approval-decision.route.test.ts`
- Create: `tests/api/operation-interrupt.route.test.ts`

**Step 1: Write the failing tests**

1. 审批 `approve` 时断言调用 `resumeAfterApproval`。
2. `interrupt` 时断言调用 `interruptTurn` 并状态更新为 `interrupted`。

**Step 2: Run tests to verify failures**

Run:

```bash
pnpm test -- tests/api/approval-decision.route.test.ts
pnpm test -- tests/api/operation-interrupt.route.test.ts
```

Expected: FAIL due missing gateway calls.

**Step 3: Write minimal implementation**

1. `approve` 分支：更新 approval/status 后调用 `gateway.resumeAfterApproval(...)`。
2. `interrupt` 路由：调用 `gateway.interruptTurn(...)`，再写状态与日志。

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test -- tests/api/approval-decision.route.test.ts
pnpm test -- tests/api/operation-interrupt.route.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/v1/approvals/[approvalId]/decision/route.ts src/app/api/v1/operations/[operationId]/interrupt/route.ts tests/api/approval-decision.route.test.ts tests/api/operation-interrupt.route.test.ts
git commit -m "feat: connect approval resume and interrupt to runner gateway"
```

### Task 7: Add Protocol Spike Verification and Guardrails

**Files:**
- Create: `tests/codex/codex-app-server-gateway.integration.test.ts`
- Modify: `README.md`
- Modify: `docs/architecture/mvp-runtime.md`
- Modify: `docs/architecture/solution-design-overview.md`

**Step 1: Write the failing integration test (opt-in)**

```ts
// tests/codex/codex-app-server-gateway.integration.test.ts
import { describe, it } from "vitest";

describe.skipIf(!process.env.RUN_CODEX_INTEGRATION)("codex app-server integration", () => {
  it("can start runner and execute one simple turn", async () => {
    // TODO: invoke codex backend with a simple prompt
  });
});
```

**Step 2: Run test to verify gating works**

Run: `pnpm test -- tests/codex/codex-app-server-gateway.integration.test.ts`  
Expected: SKIPPED by default.

**Step 3: Add preflight docs and runtime guardrails**

1. `README` 增加预检：`which codex`、`codex --version`、`EXECUTION_BACKEND=codex`。
2. 架构文档补充真实执行链路与降级策略。

**Step 4: Re-run relevant checks**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test -- tests/codex/codex-app-server-gateway.integration.test.ts
```

Expected: PASS / SKIPPED as designed.

**Step 5: Commit**

```bash
git add tests/codex/codex-app-server-gateway.integration.test.ts README.md docs/architecture/mvp-runtime.md docs/architecture/solution-design-overview.md
git commit -m "test: add codex protocol spike integration guard and docs"
```

### Task 8: Full Regression and Delivery Update

**Files:**
- Modify: `docs/progress/project-progress.md`

**Step 1: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Expected: all pass.

**Step 2: Update progress doc**

记录：

1. 更新时间
2. 本次改动摘要（真实执行链路接入）
3. 验证结果
4. 后续待办

**Step 3: Commit**

```bash
git add docs/progress/project-progress.md
git commit -m "docs: record codex execution chain phase1 completion status"
```

---

## Execution Notes

1. 严格 TDD：每个任务先红后绿。
2. 每任务单独提交，保持可回滚。
3. 若 codex 协议细节不确定，先完成 Task 7 的 spike 再继续业务接线。
4. 若出现不稳定，优先保证 `EXECUTION_BACKEND=mock` 可回退。
