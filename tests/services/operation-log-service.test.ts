import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { OperationLogService } from "@/server/services/operation-log-service";

describe("operation log service", () => {
  it("persists logs so a new service instance can read them", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_log_1", githubId: "8101", email: "svc-log@example.com", name: "Svc Log" },
    });
    await prisma.session.create({
      data: {
        id: "ses_log_1",
        userId: "usr_log_1",
        workspaceId: "ws-log-1",
        cwd: "/tmp/ws-log-1",
        threadId: "thr-log-1",
        status: "running",
      },
    });
    await prisma.operation.create({
      data: {
        id: "op_log_1",
        sessionId: "ses_log_1",
        status: "running",
        requestText: "echo log",
      },
    });

    const writer = new OperationLogService();
    await writer.append("op_log_1", { level: "info", message: "line 1" });

    const reader = new OperationLogService();
    const recent = await reader.listRecent("op_log_1", 10);

    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ level: "info", message: "line 1" });

    await prisma.$disconnect();
  });

  it("supports cursor-based log listing", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_log_2", githubId: "8102", email: "svc-log-2@example.com", name: "Svc Log 2" },
    });
    await prisma.session.create({
      data: {
        id: "ses_log_2",
        userId: "usr_log_2",
        workspaceId: "ws-log-2",
        cwd: "/tmp/ws-log-2",
        threadId: "thr-log-2",
        status: "running",
      },
    });
    await prisma.operation.create({
      data: {
        id: "op_log_2",
        sessionId: "ses_log_2",
        status: "running",
        requestText: "echo log2",
      },
    });

    const service = new OperationLogService();
    await service.append("op_log_2", { level: "info", message: "line a" });
    await service.append("op_log_2", { level: "info", message: "line b" });

    const first = await service.list("op_log_2", { afterId: 0, limit: 1 });
    expect(first.logs).toHaveLength(1);
    expect(first.logs[0].message).toBe("line a");

    const second = await service.list("op_log_2", { afterId: first.nextCursor, limit: 10 });
    expect(second.logs).toHaveLength(1);
    expect(second.logs[0].message).toBe("line b");

    await prisma.$disconnect();
  });

  it("filters logs by level and time range", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_log_3", githubId: "8103", email: "svc-log-3@example.com", name: "Svc Log 3" },
    });
    await prisma.session.create({
      data: {
        id: "ses_log_3",
        userId: "usr_log_3",
        workspaceId: "ws-log-3",
        cwd: "/tmp/ws-log-3",
        threadId: "thr-log-3",
        status: "running",
      },
    });
    await prisma.operation.create({
      data: {
        id: "op_log_3",
        sessionId: "ses_log_3",
        status: "running",
        requestText: "echo log3",
      },
    });

    await prisma.operationLog.createMany({
      data: [
        {
          operationId: "op_log_3",
          level: "info",
          message: "line old",
          createdAt: new Date("2026-03-21T00:00:00.000Z"),
        },
        {
          operationId: "op_log_3",
          level: "error",
          message: "line error",
          createdAt: new Date("2026-03-21T00:05:00.000Z"),
        },
        {
          operationId: "op_log_3",
          level: "info",
          message: "line new",
          createdAt: new Date("2026-03-21T00:10:00.000Z"),
        },
      ],
    });

    const service = new OperationLogService();
    const filtered = await service.list("op_log_3", {
      level: "error",
      from: new Date("2026-03-21T00:04:00.000Z"),
      to: new Date("2026-03-21T00:06:00.000Z"),
      limit: 20,
    });

    expect(filtered.logs).toHaveLength(1);
    expect(filtered.logs[0].message).toBe("line error");

    await prisma.$disconnect();
  });
});
