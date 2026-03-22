import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { RunnerGateway } from "@/server/codex/runner-gateway";
import { createOperationServiceForTest } from "@/server/services/operation-service";

describe("operation execution orchestration", () => {
  it("moves queued operation to running and dispatches gateway startTurn", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_exec", githubId: "5001", email: "exec@example.com", name: "Exec User" },
    });

    await prisma.session.create({
      data: {
        id: "ses_exec",
        userId: "usr_exec",
        workspaceId: "ws-exec",
        cwd: "/tmp/ws-exec",
        threadId: "thr_exec",
        status: "idle",
      },
    });

    const service = createOperationServiceForTest();
    const spy = vi.spyOn(service, "dispatchExecution");
    const op = await service.createQueued({ sessionId: "ses_exec", requestText: "echo hi" });

    await service.startExecution(op.id);

    expect(spy).toHaveBeenCalledWith(op.id);

    const refreshed = await prisma.operation.findUnique({ where: { id: op.id } });
    expect(refreshed?.status).toBe("running");

    await prisma.$disconnect();
  });

  it("skips dispatch when operation is already interrupted", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_exec_2", githubId: "5002", email: "exec2@example.com", name: "Exec User 2" },
    });

    await prisma.session.create({
      data: {
        id: "ses_exec_2",
        userId: "usr_exec_2",
        workspaceId: "ws-exec-2",
        cwd: "/tmp/ws-exec-2",
        threadId: "thr_exec_2",
        status: "idle",
      },
    });

    const op = await prisma.operation.create({
      data: {
        id: "op_exec_2",
        sessionId: "ses_exec_2",
        status: "interrupted",
        requestText: "echo skipped",
      },
    });

    const gateway: RunnerGateway = {
      backend: "mock",
      ensureRunner: vi.fn(async () => {}),
      startTurn: vi.fn(async () => ({ status: "completed" as const, resultText: "should not run" })),
      resumeAfterApproval: vi.fn(async () => ({
        status: "completed" as const,
        resultText: "should not run",
      })),
      interruptTurn: vi.fn(async () => {}),
    };

    const service = createOperationServiceForTest({ gateway });
    await service.dispatchExecution(op.id);

    expect(gateway.ensureRunner).not.toHaveBeenCalled();
    expect(gateway.startTurn).not.toHaveBeenCalled();

    const refreshed = await prisma.operation.findUnique({ where: { id: op.id } });
    expect(refreshed?.status).toBe("interrupted");

    await prisma.$disconnect();
  });
});
