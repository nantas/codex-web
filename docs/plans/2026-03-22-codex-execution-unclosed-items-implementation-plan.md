# Codex Execution Unclosed Items Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 收口当前真实后端未完成项：将 `codex exec` 过渡到 workspace 常驻 app-server 协议链路，打通真实审批触发/恢复语义，并补齐网页“发送对话”入口。

**Architecture:** 新增 `app-server` 传输层与进程管理层，`RunnerManager` 只负责 runtime 元数据与生命周期，`CodexAppServerGateway` 负责协议请求/事件翻译，`OperationService` 负责状态机落库与幂等。前端在 `SessionDetailLive` 增加 turn composer，继续复用现有 polling 与 logs 能力。

**Tech Stack:** Next.js App Router, TypeScript, Prisma + SQLite, Vitest, Playwright, host-installed `codex` CLI (`app-server` + `exec` fallback).

---

### Task 1: Add App-Server Protocol Model and Client Skeleton

**Files:**
- Create: `src/server/codex/app-server/protocol.ts`
- Create: `src/server/codex/app-server/client.ts`
- Create: `tests/codex/app-server-client.test.ts`

**Step 1: Write the failing test**

```ts
// tests/codex/app-server-client.test.ts
import { describe, expect, it } from "vitest";
import { parseAppServerLine } from "@/server/codex/app-server/client";

describe("app-server client protocol", () => {
  it("parses json line payload", () => {
    const parsed = parseAppServerLine('{"id":"1","type":"turn.completed"}');
    expect(parsed).toMatchObject({ id: "1", type: "turn.completed" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/codex/app-server-client.test.ts`  
Expected: FAIL with module/function not found.

**Step 3: Write minimal implementation**

```ts
// src/server/codex/app-server/client.ts
export function parseAppServerLine(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}
```

```ts
// src/server/codex/app-server/protocol.ts
export type AppServerTurnCompletedEvent = {
  id: string;
  type: "turn.completed";
  outputText: string;
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/codex/app-server-client.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/codex/app-server/protocol.ts src/server/codex/app-server/client.ts tests/codex/app-server-client.test.ts
git commit -m "feat: add codex app-server protocol skeleton"
```

### Task 2: Add Persistent Runner Process Manager (Workspace-Scoped)

**Files:**
- Create: `src/server/codex/app-server/process-manager.ts`
- Modify: `src/server/codex/types.ts`
- Modify: `src/server/codex/runner-manager.ts`
- Create: `tests/codex/process-manager.test.ts`
- Modify: `tests/codex/runner-manager.test.ts`

**Step 1: Write the failing test**

```ts
// tests/codex/process-manager.test.ts
import { describe, expect, it } from "vitest";
import { AppServerProcessManager } from "@/server/codex/app-server/process-manager";

describe("AppServerProcessManager", () => {
  it("reuses one process per workspace", async () => {
    const manager = new AppServerProcessManager();
    const first = await manager.getOrStart("ws-1", { cwd: "/tmp/ws-1" });
    const second = await manager.getOrStart("ws-1", { cwd: "/tmp/ws-1" });
    expect(second.id).toBe(first.id);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/codex/process-manager.test.ts tests/codex/runner-manager.test.ts`  
Expected: FAIL with missing module/methods.

**Step 3: Write minimal implementation**

```ts
// src/server/codex/app-server/process-manager.ts
export class AppServerProcessManager {
  private readonly byWorkspace = new Map<string, { id: string }>();

  async getOrStart(workspaceId: string, _input: { cwd: string }) {
    const existing = this.byWorkspace.get(workspaceId);
    if (existing) return existing;
    const created = { id: crypto.randomUUID() };
    this.byWorkspace.set(workspaceId, created);
    return created;
  }
}
```

并在 `RunnerManager` 增加 `bindProcessMeta(...)`，回写 `pid/endpoint/status/lastSeenAt`。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/codex/process-manager.test.ts tests/codex/runner-manager.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/codex/app-server/process-manager.ts src/server/codex/types.ts src/server/codex/runner-manager.ts tests/codex/process-manager.test.ts tests/codex/runner-manager.test.ts
git commit -m "feat: add workspace-scoped app-server process manager"
```

### Task 3: Switch Codex Gateway to App-Server First with Exec Fallback

**Files:**
- Modify: `src/server/codex/backends/codex-app-server-gateway.ts`
- Modify: `src/server/codex/runner-gateway.ts`
- Modify: `tests/codex/codex-app-server-gateway.integration.test.ts`
- Create: `tests/codex/codex-app-server-gateway.unit.test.ts`

**Step 1: Write the failing unit test**

```ts
// tests/codex/codex-app-server-gateway.unit.test.ts
import { describe, expect, it } from "vitest";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";

describe("CodexAppServerGateway", () => {
  it("maps app-server completed event to completed result", async () => {
    const gateway = new CodexAppServerGateway(/* inject fake client */);
    const result = await gateway.startTurn({
      operationId: "op-1",
      workspaceId: "ws-1",
      cwd: "/tmp/ws-1",
      sessionId: "ses-1",
      threadId: "thr-1",
      text: "hello",
    });
    expect(result.status).toBe("completed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/codex/codex-app-server-gateway.unit.test.ts`  
Expected: FAIL because dependency injection / mapping not implemented.

**Step 3: Write minimal implementation**

- `startTurn` 尝试通过 `app-server client` 发送 turn。
- 若 app-server unavailable，fallback 到现有 `codex exec` 路径。

```ts
if (appServerAvailable) {
  const event = await this.client.startTurn(...);
  if (event.type === "turn.completed") return { status: "completed", resultText: event.outputText };
  if (event.type === "turn.approval_required") return { status: "waitingApproval", kind: event.kind, prompt: event.prompt };
}
return this.runCodexExec(...);
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test -- tests/codex/codex-app-server-gateway.unit.test.ts
RUN_CODEX_INTEGRATION=1 CODEX_EXEC_TIMEOUT_MS=60000 pnpm test -- tests/codex/codex-app-server-gateway.integration.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/codex/backends/codex-app-server-gateway.ts src/server/codex/runner-gateway.ts tests/codex/codex-app-server-gateway.unit.test.ts tests/codex/codex-app-server-gateway.integration.test.ts
git commit -m "feat: prefer app-server protocol in codex gateway with exec fallback"
```

### Task 4: Implement Real Approval Trigger and Resume Continuation Semantics

**Files:**
- Modify: `src/server/services/operation-execution-registry.ts`
- Modify: `src/server/services/operation-service.ts`
- Modify: `src/app/api/v1/approvals/[approvalId]/decision/route.ts`
- Modify: `tests/services/operation-execution.service.test.ts`
- Modify: `tests/api/approval-decision.route.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/services/operation-execution.service.test.ts
it("persists approval token when runner requests approval", async () => {
  // gateway.startTurn -> waitingApproval with continuationToken
  // expect registry contains continuationToken
});

it("resumeAfterApproval uses continuation token, not prompt replay", async () => {
  // expect gateway.resumeAfterApproval called with continuationToken
});
```

**Step 2: Run tests to verify failures**

Run:

```bash
pnpm test -- tests/services/operation-execution.service.test.ts tests/api/approval-decision.route.test.ts
```

Expected: FAIL due missing continuation token flow.

**Step 3: Write minimal implementation**

- `OperationExecutionRegistry` 新增字段：`continuationToken`。
- `OperationService.applyTurnResult(waitingApproval)` 落库 approval 并保存 token。
- `resumeAfterApproval` 优先读取 token 调用 gateway continuation。

```ts
this.registry.set({ ...handle, continuationToken: result.continuationToken });
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test -- tests/services/operation-execution.service.test.ts tests/api/approval-decision.route.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/services/operation-execution-registry.ts src/server/services/operation-service.ts src/app/api/v1/approvals/[approvalId]/decision/route.ts tests/services/operation-execution.service.test.ts tests/api/approval-decision.route.test.ts
git commit -m "feat: wire approval continuation token through service and api"
```

### Task 5: Harden Interrupt Semantics for App-Server and Fallback Paths

**Files:**
- Modify: `src/server/codex/backends/codex-app-server-gateway.ts`
- Modify: `src/server/services/operation-service.ts`
- Modify: `tests/api/operation-interrupt.route.test.ts`
- Create: `tests/codex/codex-app-server-interrupt.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/codex/codex-app-server-interrupt.test.ts
it("sends interrupt to app-server active turn handle", async () => {
  // assert client.interruptTurn called once
});

it("falls back to process signal when protocol interrupt unavailable", async () => {
  // assert SIGINT/SIGKILL path used
});
```

**Step 2: Run tests to verify failures**

Run: `pnpm test -- tests/codex/codex-app-server-interrupt.test.ts tests/api/operation-interrupt.route.test.ts`  
Expected: FAIL due missing protocol interrupt path.

**Step 3: Write minimal implementation**

- 优先调用 app-server interrupt API。
- 若 unsupported/error，退回现有 process signal interrupt。
- 保持终态幂等保护不变。

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/codex/codex-app-server-interrupt.test.ts tests/api/operation-interrupt.route.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/codex/backends/codex-app-server-gateway.ts src/server/services/operation-service.ts tests/codex/codex-app-server-interrupt.test.ts tests/api/operation-interrupt.route.test.ts
git commit -m "fix: support protocol-first interrupt with signal fallback"
```

### Task 6: Add Web Turn Composer on Session Detail Page

**Files:**
- Create: `src/components/sessions/session-turn-composer.tsx`
- Modify: `src/components/sessions/session-detail-live.tsx`
- Modify: `tests/ui/session-detail-live.test.tsx`
- Modify: `tests/e2e/mvp-flow.spec.ts`

**Step 1: Write the failing UI test**

```tsx
// tests/ui/session-detail-live.test.tsx
it("submits a new turn from composer and refreshes operations", async () => {
  // render SessionDetailLive
  // type message, click send
  // assert POST /api/v1/operations payload contains turn.start
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/ui/session-detail-live.test.tsx`  
Expected: FAIL because composer does not exist.

**Step 3: Write minimal implementation**

```tsx
// src/components/sessions/session-turn-composer.tsx
export default function SessionTurnComposer({ onSubmit, disabled }: Props) {
  const [text, setText] = useState("");
  return (
    <form onSubmit={...}>
      <textarea value={text} onChange={...} />
      <button type="submit" disabled={disabled || !text.trim()}>Send</button>
    </form>
  );
}
```

在 `SessionDetailLive` 中接入：提交后调用 `/api/v1/operations`，成功后 `refresh()`。

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test -- tests/ui/session-detail-live.test.tsx
pnpm test:e2e -- tests/e2e/mvp-flow.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/sessions/session-turn-composer.tsx src/components/sessions/session-detail-live.tsx tests/ui/session-detail-live.test.tsx tests/e2e/mvp-flow.spec.ts
git commit -m "feat: add web turn composer on session detail"
```

### Task 7: Regression, Docs, and Delivery Record

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/mvp-runtime.md`
- Modify: `docs/architecture/solution-design-overview.md`
- Modify: `docs/architecture/tech-stack-overview.md`
- Modify: `docs/progress/project-progress.md`

**Step 1: Update docs for final execution model**

- 明确 `app-server first + exec fallback`。
- 写明 `codex login`、`RUN_CODEX_INTEGRATION`、网页 composer 手工验证步骤。

**Step 2: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
RUN_CODEX_INTEGRATION=1 CODEX_EXEC_TIMEOUT_MS=60000 pnpm test -- tests/codex/codex-app-server-gateway.integration.test.ts
```

Expected: PASS.

**Step 3: Update progress document**

记录：
1. 更新时间
2. 改动摘要（协议链路 + 审批恢复 + interrupt + composer）
3. 验证结果
4. 后续待办

**Step 4: Commit**

```bash
git add README.md docs/architecture/mvp-runtime.md docs/architecture/solution-design-overview.md docs/architecture/tech-stack-overview.md docs/progress/project-progress.md
git commit -m "docs: record app-server closure and web conversation entry"
```

---

## Execution Notes

- 严格按 TDD 执行：每个任务先红后绿。
- 每个任务单独提交，便于回滚与 bisect。
- 若 app-server 协议与本地 codex 版本不兼容，保持 `exec fallback` 不被破坏。
- 若遇到不确定协议字段，先在 `tests/codex/*` 固化 contract 再扩展实现（`@superpowers:test-driven-development`）。
