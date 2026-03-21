import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createOperationServiceForTest } from "@/server/services/operation-service";

describe("operation service", () => {
  it("moves to waitingApproval when approval is requested", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        id: "usr_1",
        githubId: "2001",
        email: "service@example.com",
        name: "Service User",
      },
    });

    await prisma.session.create({
      data: {
        id: "ses_1",
        userId: "usr_1",
        workspaceId: "ws-1",
        cwd: "/tmp/workspace",
        threadId: "thr_1",
        status: "idle",
      },
    });

    const service = createOperationServiceForTest();
    const op = await service.createQueued({ sessionId: "ses_1", requestText: "run ls" });
    await service.markRunning(op.id);
    const approval = await service.requireApproval(op.id, {
      kind: "commandExecution",
      prompt: "Approve command?",
    });
    const polled = await service.getById(op.id);
    expect(polled?.status).toBe("waitingApproval");
    expect(approval.kind).toBe("commandExecution");

    await prisma.$disconnect();
  });
});
