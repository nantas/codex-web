# 项目进度（Codex Web MVP）

更新时间：2026-03-21

## 1. 总体状态

- 阶段：MVP 已完成（可运行、可登录、可轮询、可审批）
- 当前分支：`main`
- 状态：开发功能与文档均已落地，进入稳态迭代阶段

## 2. 里程碑完成情况

### M1 基础工程与测试基线

- 状态：完成
- 内容：Next.js 脚手架、Vitest、健康检查接口、基础脚本

### M2 控制面模型与契约

- 状态：完成
- 内容：Zod 契约、Prisma Schema、迁移、数据库访问封装

### M3 核心域能力

- 状态：完成
- 内容：Operation 状态机、RunnerManager 抽象、Session/Operation Service

### M4 API 与鉴权

- 状态：完成
- 内容：`/api/v1/*` 路由、Auth.js GitHub OAuth、路由保护

### M5 前端控制台

- 状态：完成
- 内容：`/login`、`/sessions`、`/sessions/[sessionId]`、审批展示组件

### M6 质量与交付文档

- 状态：完成
- 内容：Playwright 冒烟、运行时架构文档、Host/Remote 访问指南

### M7 远程访问与 OAuth 适配

- 状态：完成
- 内容：默认端口改为 `43173`、Tailscale URL 统一、OAuth 打开入口修复

## 3. 已解决关键问题

- OAuth 启动 URL 从错误的 provider endpoint 改为正确的 sign-in 页面入口
- 本地/远程统一 URL 与回调策略，避免回调不一致
- Vitest 与 SQLite 并发干扰问题已处理（串行文件执行）

## 4. 当前验证状态

- `pnpm lint`：通过
- `pnpm typecheck`：通过
- `pnpm test`：通过
- `pnpm test:e2e`：通过
- 人工验证：OAuth 登录到 `/sessions` 已通过

## 5. 未完成/后续工作

- 真实 Codex CLI 执行链路尚未接入（当前以 MVP 控制面为主）
- 前端会话/详情仍有占位数据，后续切换为完整实时数据流
- 生产部署（HTTPS、反向代理、监控告警）尚未标准化

## 6. 建议下一阶段（P1）

1. 接入真实执行通道与任务日志回传
2. 完成会话详情页端到端真实数据闭环
3. 增加 OAuth 与关键 API 的失败场景自动化测试
4. 增加部署文档（systemd/pm2 + reverse proxy + TLS）
