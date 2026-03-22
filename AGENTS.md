# AGENTS 手册（codex-web）

本文件定义本仓库的 Agent 协作规则、文档治理要求与交付检查清单。

## 1. 仓库目标与范围

- 当前阶段：Codex Web MVP（HTTP Polling + Approval Queue + GitHub OAuth）
- 运行形态：单体 Next.js（App Router），同仓同时承载 UI 与 API
- 网络访问：Host 服务默认监听 `0.0.0.0:43173`，支持 Tailscale 远程访问

## 2. 基础工程约束

- Next.js 版本较新，编码前必须参考 `node_modules/next/dist/docs/` 对应文档。
- 不得提交敏感信息（`.env`、密钥、token、个人域名中的私密参数）。
- 涉及身份验证、网络入口、端口、回调地址等改动时，优先做本地 + 远程可达性验证。

## 3. 文档总索引（必须维护）

### 根文档

- [README.md](README.md)（快速启动与访问流程）
- [AGENTS.md](AGENTS.md)（本手册）

### 架构文档

- [docs/architecture/tech-stack-overview.md](docs/architecture/tech-stack-overview.md)
- [docs/architecture/solution-design-overview.md](docs/architecture/solution-design-overview.md)
- [docs/architecture/mvp-runtime.md](docs/architecture/mvp-runtime.md)

### 指南文档

- [docs/guides/host-remote-access-and-auth.md](docs/guides/host-remote-access-and-auth.md)

### 进度文档

- [docs/progress/project-progress.md](docs/progress/project-progress.md)

### 任务与交接入口（Canonical）

- [docs/plans/README.md](docs/plans/README.md)（统一任务/计划发现入口）
- [docs/handoff/current-handoff.md](docs/handoff/current-handoff.md)（统一交接入口）
- [docs/progress/project-progress.md](docs/progress/project-progress.md)（统一进展回填入口）

### 历史计划文档（只读，除非用户明确要求）

- [docs/plans/2026-03-21-codex-web-mvp-http-polling.md](docs/plans/2026-03-21-codex-web-mvp-http-polling.md)
- [docs/plans/2026-03-21-oauth-browser-launch-design.md](docs/plans/2026-03-21-oauth-browser-launch-design.md)

## 4. 强制工作流约束（新增）

### 4.1 需求/缺陷执行后的必做项

当用户提出新需求、功能修改、问题修复并完成执行后：

1. 必须更新 [docs/progress/project-progress.md](docs/progress/project-progress.md)。
2. 更新至少包含：
   - 更新时间
   - 本次改动摘要
   - 验证结果
   - 后续待办（如有）
3. 若本次改动影响任务状态或接手信息，必须同步更新 [docs/handoff/current-handoff.md](docs/handoff/current-handoff.md)，并与进度回填的更新时间和摘要保持一致。

### 4.2 新建文档的确认门槛

如判断需要新增文档（`docs/**` 下新文件），必须先征得用户确认，再创建。

例外：

- 用户已明确要求“新增文档”时，可直接创建。
- 对既有文档的更新（非新建）不需要再次确认。

## 5. 变更触发表（动作 -> 必须更新的文档）

| 变更动作 | 必须更新文档 |
| --- | --- |
| 新增/替换依赖、升级框架版本、运行命令变更 | `docs/architecture/tech-stack-overview.md`、`README.md`、`docs/progress/project-progress.md` |
| 认证流程、OAuth 回调、登录入口、会话策略变更 | `docs/guides/host-remote-access-and-auth.md`、`docs/architecture/solution-design-overview.md`、`README.md`、`docs/progress/project-progress.md` |
| 端口、host 监听、远程访问方式（如 Tailscale）变更 | `README.md`、`docs/guides/host-remote-access-and-auth.md`、`docs/architecture/tech-stack-overview.md`、`docs/progress/project-progress.md` |
| API 新增/删除/语义变化 | `docs/architecture/solution-design-overview.md`、`docs/architecture/mvp-runtime.md`、`README.md`（如面向使用者）、`docs/progress/project-progress.md` |
| 领域状态机、服务层流程、审批机制变更 | `docs/architecture/mvp-runtime.md`、`docs/architecture/solution-design-overview.md`、`docs/progress/project-progress.md` |
| 测试策略、测试命令、验证门槛变更 | `README.md`、`docs/progress/project-progress.md` |
| 仅文案/排版修订（无行为变化） | 被改动文档本身；若对外行为认知有影响，仍需更新 `docs/progress/project-progress.md` |

## 6. 交付前检查清单（最小）

1. 代码与配置修改已完成。
2. 相关验证命令已执行并记录结果。
3. 按“变更触发表”更新对应文档。
4. [docs/progress/project-progress.md](docs/progress/project-progress.md) 已同步本次变更。
5. 如涉及任务状态流转，[docs/handoff/current-handoff.md](docs/handoff/current-handoff.md) 已同步更新并与进度回填一致。
6. 若新增了文档，已确认用户事先同意。

## 7. 建议验证命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

当改动包含认证/网络入口时，补充人工验证：

- `/api/health` 本地与远程均可达
- 登录入口可用且 OAuth 回调成功
- `/sessions` 页面可访问
