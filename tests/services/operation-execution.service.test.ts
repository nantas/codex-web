import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { RunnerGateway } from "@/server/codex/runner-gateway";
import { OperationExecutionRegistry } from "@/server/services/operation-execution-registry";
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

  it("persists approval continuation token when runner requests approval", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_exec_3", githubId: "5003", email: "exec3@example.com", name: "Exec User 3" },
    });

    await prisma.session.create({
      data: {
        id: "ses_exec_3",
        userId: "usr_exec_3",
        workspaceId: "ws-exec-3",
        cwd: "/tmp/ws-exec-3",
        threadId: "thr_exec_3",
        status: "idle",
      },
    });

    const gateway: RunnerGateway = {
      backend: "mock",
      ensureRunner: vi.fn(async () => {}),
      startTurn: vi.fn(async () => ({
        status: "waitingApproval" as const,
        kind: "commandExecution",
        prompt: "Approve command?",
        continuationToken: "cont-token-3",
      })),
      resumeAfterApproval: vi.fn(async () => ({
        status: "completed" as const,
        resultText: "should not run",
      })),
      interruptTurn: vi.fn(async () => {}),
    };

    const registry = new OperationExecutionRegistry();
    const service = createOperationServiceForTest({ gateway, registry });
    const op = await service.createQueued({ sessionId: "ses_exec_3", requestText: "rm -rf /tmp/test" });
    await service.markRunning(op.id);
    await service.dispatchExecution(op.id);

    const handle = registry.get(op.id);
    expect(handle?.continuationToken).toBe("cont-token-3");

    const refreshed = await prisma.operation.findUnique({ where: { id: op.id } });
    expect(refreshed?.status).toBe("waitingApproval");

    await prisma.$disconnect();
  });

  it("resumeAfterApproval uses continuation token, not prompt replay", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_exec_4", githubId: "5004", email: "exec4@example.com", name: "Exec User 4" },
    });

    await prisma.session.create({
      data: {
        id: "ses_exec_4",
        userId: "usr_exec_4",
        workspaceId: "ws-exec-4",
        cwd: "/tmp/ws-exec-4",
        threadId: "thr_exec_4",
        status: "idle",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_exec_4",
        sessionId: "ses_exec_4",
        status: "waitingApproval",
        requestText: "resume me",
      },
    });

    const gateway: RunnerGateway = {
      backend: "mock",
      ensureRunner: vi.fn(async () => {}),
      startTurn: vi.fn(async () => ({ status: "running" as const })),
      resumeAfterApproval: vi.fn(async () => ({
        status: "completed" as const,
        resultText: "resumed with continuation token",
      })),
      interruptTurn: vi.fn(async () => {}),
    };

    const registry = new OperationExecutionRegistry();
    registry.set({
      operationId: "op_exec_4",
      sessionId: "ses_exec_4",
      workspaceId: "ws-exec-4",
      cwd: "/tmp/ws-exec-4",
      threadId: "thr_exec_4",
      continuationToken: "cont-token-4",
    });

    const service = createOperationServiceForTest({ gateway, registry });
    await service.resumeAfterApproval({
      operationId: "op_exec_4",
      approvalId: "apr_exec_4",
      decision: "approve",
    });

    expect(gateway.resumeAfterApproval).toHaveBeenCalledWith({
      operationId: "op_exec_4",
      approvalId: "apr_exec_4",
      decision: "approve",
      continuationToken: "cont-token-4",
    });

    await prisma.$disconnect();
  });
});
