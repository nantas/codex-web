# Codex CLI Phase 2 Stability Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在进入下一轮功能开发前，完成真实 Codex CLI 链路的可观测性、验收基线与重试治理，确保问题可复现、可定位、可回归。

**Architecture:** 采用“先稳定后扩展”的顺序：先补失败路径事件级诊断，再固化人工/API 验收脚本，然后把 transient 重试规则从散落条件收敛为统一签名治理，最后再给出功能开发准入门槛。所有新增能力都遵循失败优先（failure-first）测试、最小改动、可回滚。计划默认在现有 `main` 基础上增量实现，不引入新后端组件。

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, Playwright, Node.js scripts

---

### Task 1: 失败路径事件级诊断日志（仅异常输出）

**Files:**
- Modify: `src/server/codex/app-server/codex-cli-app-server-client.ts`
- Modify: `src/server/codex/app-server/process-manager.ts`
- Test: `tests/codex/codex-cli-app-server-client.test.ts`

**Step 1: Write the failing test**

```ts
it("includes thread/turn/request summary in timeout execution error", async () => {
  // arrange: thread/read keeps running until timeout
  // assert: thrown AppServerClientError.message contains
  // threadId=..., turnId=..., lastNotificationMethod=...
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/codex/codex-cli-app-server-client.test.ts --maxWorkers=1`
Expected: FAIL，提示错误消息不含诊断摘要字段。

**Step 3: Write minimal implementation**

```ts
const diag = {
  threadId: input.threadId,
  turnId: input.turnId,
  lastNotificationMethod,
  lastThreadReadAt,
};
throw new AppServerClientError("timeout", `... | diag=${JSON.stringify(diag)}`);
```

```ts
// process-manager.ts
recordLastNotification(handle.workspaceId, {
  method: payload.method,
  at: new Date().toISOString(),
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/codex/codex-cli-app-server-client.test.ts --maxWorkers=1`
Expected: PASS（诊断字段存在且格式稳定）。

**Step 5: Commit**

```bash
git add src/server/codex/app-server/codex-cli-app-server-client.ts src/server/codex/app-server/process-manager.ts tests/codex/codex-cli-app-server-client.test.ts
git commit -m "feat: add failure-path app-server diagnostic context"
```

### Task 2: 固化真实后端验收脚本与判定口径

**Files:**
- Create: `scripts/validation/real-codex-approval-smoke.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Test: `tests/e2e/mvp-flow.spec.ts`

**Step 1: Write the failing test**

```ts
it("documents deterministic real-backend smoke command", () => {
  // assert package.json contains script: validate:real-codex
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/e2e/mvp-flow.spec.ts --maxWorkers=1`
Expected: FAIL（`validate:real-codex` 未定义）。

**Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "validate:real-codex": "node scripts/validation/real-codex-approval-smoke.mjs"
  }
}
```

```js
// real-codex-approval-smoke.mjs
// 1) create session
// 2) submit dangerous prompt
// 3) wait waitingApproval
// 4) deny decision
// 5) assert operation failed
// exitCode=0 on success
```

```md
# README
pnpm validate:real-codex
# expected: waitingApproval reached, deny -> failed
```

**Step 4: Run test to verify it passes**

Run: `pnpm validate:real-codex`
Expected: PASS（打印 summary JSON，exit code 0）。

**Step 5: Commit**

```bash
git add scripts/validation/real-codex-approval-smoke.mjs package.json README.md tests/e2e/mvp-flow.spec.ts
git commit -m "feat: add executable real codex approval smoke validation"
```

### Task 3: 重试白名单治理（签名注册 + 单点判定）

**Files:**
- Create: `src/server/codex/app-server/transient-error-signatures.ts`
- Modify: `src/server/codex/app-server/codex-cli-app-server-client.ts`
- Test: `tests/codex/codex-cli-app-server-client.test.ts`

**Step 1: Write the failing test**

```ts
it("classifies configured signatures as transient via shared registry", () => {
  // assert new signature table drives retry decision
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/codex/codex-cli-app-server-client.test.ts --maxWorkers=1`
Expected: FAIL（当前仍是硬编码 `includes(...)`）。

**Step 3: Write minimal implementation**

```ts
// transient-error-signatures.ts
export const TRANSIENT_APP_SERVER_ERROR_SIGNATURES = [
  ["not materialized yet"],
  ["includeturns is unavailable"],
  ["failed to load rollout", "empty session file"],
] as const;

export function matchesTransientSignature(message: string) {
  const lower = message.toLowerCase();
  return TRANSIENT_APP_SERVER_ERROR_SIGNATURES.some((all) =>
    all.every((part) => lower.includes(part)),
  );
}
```

```ts
// codex-cli-app-server-client.ts
return matchesTransientSignature(error.message);
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/codex/codex-cli-app-server-client.test.ts --maxWorkers=1`
Expected: PASS（签名驱动重试逻辑通过）。

**Step 5: Commit**

```bash
git add src/server/codex/app-server/transient-error-signatures.ts src/server/codex/app-server/codex-cli-app-server-client.ts tests/codex/codex-cli-app-server-client.test.ts
git commit -m "refactor: centralize app-server transient retry signatures"
```

### Task 4: 开发准入门槛与执行前检查清单

**Files:**
- Modify: `docs/architecture/mvp-runtime.md`
- Modify: `docs/handoff/current-handoff.md`
- Modify: `docs/progress/project-progress.md`
- Modify: `docs/plans/README.md`

**Step 1: Write the failing test**

```md
# Checklist assertions (manual)
- README/plans index contains Phase 2 entry gate
- gate requires: diagnostics + smoke + retry registry + green CI
```

**Step 2: Run check to verify it fails**

Run: `rg -n "Phase 2 Entry Gate|validate:real-codex|transient signature registry" docs README.md`
Expected: 无完整门槛定义（grep 缺项）。

**Step 3: Write minimal implementation**

```md
## Phase 2 Entry Gate
1. Failure-path diagnostics landed
2. pnpm validate:real-codex green
3. transient signature registry documented
4. lint/typecheck/test/test:e2e green
```

**Step 4: Run check to verify it passes**

Run: `rg -n "Phase 2 Entry Gate|validate:real-codex|transient signature registry" docs README.md`
Expected: PASS（4 条门槛均可检索）。

**Step 5: Commit**

```bash
git add docs/architecture/mvp-runtime.md docs/handoff/current-handoff.md docs/progress/project-progress.md docs/plans/README.md
git commit -m "docs: define phase-2 development entry gate"
```

### Task 5: 全量回归与分段合并

**Files:**
- Modify: `docs/progress/project-progress.md`
- Modify: `docs/handoff/current-handoff.md`

**Step 1: Write the failing test**

```md
# manual release checklist
- each task has commit hash + verification evidence
- final summary includes residual risks
```

**Step 2: Run checks to verify incomplete state**

Run: `git log --oneline -n 10`
Expected: 尚未形成按任务分段提交记录。

**Step 3: Write minimal implementation**

```md
# progress/handoff append
- Task1..Task4 commit ids
- command outputs summary
- residual risks + rollback note
```

**Step 4: Run final verification**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `DATABASE_URL='file:/Users/nantas-agent/projects/codex-web/prisma/dev.db' pnpm test -- --maxWorkers=1`
- `DATABASE_URL='file:/Users/nantas-agent/projects/codex-web/prisma/dev.db' pnpm test:e2e`
- `pnpm validate:real-codex`

Expected: 全部 PASS。

**Step 5: Commit**

```bash
git add docs/progress/project-progress.md docs/handoff/current-handoff.md
git commit -m "docs: record phase-2 readiness verification and residual risks"
```

---

## Execution Notes

- 必须按 TDD 顺序执行（先失败测试，再最小实现）。
- 每个 Task 完成后立即提交，避免大批量混改。
- 保持 DRY/YAGNI：仅增加定位问题与准入治理必要代码。
- 执行时建议显式使用：`@superpowers:executing-plans`、`@superpowers:verification-before-completion`。
