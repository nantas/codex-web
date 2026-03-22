# 任务/计划入口（Canonical Task Entry）

本文件是 codex-web 的统一任务发现入口。新 agent 应先阅读本文件，再进入当前执行计划。

## 使用顺序

1. 先阅读仓库根 `AGENTS.md`（规则入口）。
2. 从本页定位当前执行任务与计划。
3. 执行后将结果回填 `docs/progress/project-progress.md`，并同步 `docs/handoff/current-handoff.md`。

## Canonical 路径

- 任务入口：`docs/plans/README.md`（本文件）
- 交接入口：`docs/handoff/current-handoff.md`
- 进展回填入口：`docs/progress/project-progress.md`

## 当前有效计划（按优先级）

1. `docs/plans/2026-03-22-codex-execution-unclosed-items-implementation-plan.md`（当前未收口项实施主计划）
2. `docs/plans/2026-03-22-codex-cli-execution-chain-implementation-plan.md`（执行链路 Phase 1 计划，作为上下文参考）

## Phase 2 Entry Gate

开始 Phase 2 功能开发前，必须先满足：

1. failure-path diagnostics 已上线（超时含 thread/turn/request 诊断摘要）。
2. `pnpm validate:real-codex` 通过（`waitingApproval -> deny -> failed`）。
3. transient signature registry 已集中治理并生效。
4. `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:e2e` 全绿。

## 历史计划（只读）

- `docs/plans/2026-03-21-codex-web-mvp-http-polling.md`
- `docs/plans/2026-03-21-oauth-browser-launch-design.md`
- `docs/plans/2026-03-22-codex-cli-execution-chain-design.md`

除非用户明确要求，不重写历史计划文档。新增计划请遵循 `YYYY-MM-DD-<topic>-implementation-plan.md` 命名，并回链到本页。
