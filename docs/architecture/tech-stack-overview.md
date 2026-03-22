# 技术栈总览（Codex Web MVP）

本文档汇总当前仓库实际落地的技术栈与用途。

## 1. 应用框架

- Next.js 16（App Router）
- TypeScript 5
- React 19

用途：

- 同一应用承载前端页面与后端 API 路由
- 基于 App Router 组织 `/app` 页面与 `/api` 接口

## 2. 认证与授权

- Auth.js / NextAuth (`next-auth@5 beta`)
- Provider: GitHub OAuth App

用途：

- 通过 GitHub OAuth 完成用户登录
- 使用 `/api/auth/*` 进行认证流程
- 通过中间件保护 `/sessions` 与 `/api/v1/*` 路由

## 3. 数据层

- Prisma ORM
- SQLite（MVP 本地持久化）

核心模型：

- `User`
- `Session`
- `Operation`
- `Approval`
- `OperationLog`

用途：

- 存储控制面状态
- 支撑 operation 轮询与审批状态更新

## 4. 接口契约与校验

- Zod

用途：

- 定义 API 请求结构
- 在 Route Handler 中做输入解析与基础校验

## 5. 前端状态与 UI

- TanStack Query（已引入基础 QueryClient）
- Tailwind CSS

用途：

- 为后续前端请求缓存与状态管理预留基础设施
- 提供 MVP 页面样式能力

## 6. 测试体系

- Vitest（单元/集成测试）
- Testing Library + jsdom（组件测试）
- Playwright（E2E 冒烟）

覆盖类型：

- API route 测试
- 领域状态机测试
- Service 层测试
- UI 组件测试
- 登录后页面可见性冒烟

## 7. 运行与网络

- 默认端口：`43173`
- Host 监听：`0.0.0.0`
- 远程访问：Tailscale 域名
- 执行后端开关：`EXECUTION_BACKEND=mock|codex`（默认 `mock`）
- 执行通道：host-installed `codex` CLI（workspace-resident app-server protocol + `codex exec` fallback）
- 调试/测试覆盖：`CODEX_BIN` 支持覆盖 codex 可执行路径

用途：

- 支持宿主机本地访问与 tailnet 远程访问
- OAuth 回调统一到可远程访问域名
- 在 `mock` 与 `codex` 后端间可切换，异常时可快速回退到 `mock`
- codex 后端下优先复用协议链路（审批恢复/中断）
- app-server 仅在 `unavailable` 错误时回落 `exec`，协议/执行/超时错误直接分类返回

## 8. 工程命令（当前）

- `pnpm dev`：开发服务（43173）
- `pnpm start`：生产启动（43173）
- `pnpm oauth:github`：打开 OAuth 登录页
- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm test:e2e`
- `which codex` / `codex --version` / `codex login`：启用 codex 后端前的本机预检
- `pnpm exec vitest run tests/codex/codex-app-server-gateway.integration.test.ts`：默认稳定的 codex 集成校验（fake codex fixture）

## 9. 当前边界

- 已完成 HTTP polling 控制面与认证闭环
- 已接入执行后端抽象与切换（`mock|codex`），`codex` 后端可通过真实 `codex exec` 执行 operation
- 已具备网页会话详情 `Send Turn` 入口，可直接触发 `turn.start`
- 已接入 workspace 常驻 app-server 协议通道；真实生产验证仍需覆盖真实 codex 环境下的长时间运行与审批恢复边界
