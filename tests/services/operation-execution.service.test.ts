import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
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
});
