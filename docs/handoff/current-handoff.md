# 当前交接入口（Canonical Handoff Entry）

更新时间：2026-03-22（Codex CLI 执行链路 Phase 1 第二十一批）

## 当前状态

- 阶段：MVP 已完成，进入真实 codex CLI 人工验证与协议细化阶段。
- 当前任务主入口：`docs/plans/README.md`
- 当前主计划：`docs/plans/2026-03-22-codex-execution-unclosed-items-implementation-plan.md`

## 本次交接摘要

- 已将 codex app-server 通道从占位实现升级为 workspace 常驻真实子进程链路（`AppServerProcessManager` + `CodexCliAppServerClient`）。
- `CodexAppServerGateway` fallback 规则已收敛：仅 `app-server unavailable` 回退到 `codex exec`，协议/执行/超时错误直接分类返回。
- 已新增 codex exec 鉴权失败分类测试，并将 codex integration 用例改为默认稳定执行（fake codex fixture，不再依赖 `RUN_CODEX_INTEGRATION`）。
- README 与 architecture/progress 文档已同步到当前行为。

## 验证摘要

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `DATABASE_URL="file:/Users/nantas-agent/projects/codex-web/.worktrees/codex-cli-hardening/prisma/dev.db" pnpm test`：通过（30 files, 69 passed）
- `DATABASE_URL="file:/Users/nantas-agent/projects/codex-web/.worktrees/codex-cli-hardening/prisma/dev.db" pnpm test:e2e`：通过（1 passed）

## 下一位 Agent 接手

1. 从 `AGENTS.md` 读取规则与交付清单。
2. 从 `docs/plans/README.md` 进入当前任务计划。
3. 优先执行真实 codex CLI 人工验证（网页端 Send Turn / 审批恢复 / interrupt / 日志可见性 / 本地与远程可达）。
4. 完成任务后同步更新：
   - `docs/progress/project-progress.md`
   - `docs/handoff/current-handoff.md`
