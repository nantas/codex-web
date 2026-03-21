import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("prisma schema", () => {
  it("can persist user/session/operation/approval minimal records", async () => {
    const prisma = new PrismaClient();
    const user = await prisma.user.create({
      data: { githubId: "1001", email: "mvp@example.com", name: "MVP User" },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        workspaceId: "ws-1",
        cwd: "/tmp/workspace",
        threadId: "thr_1",
        status: "idle",
      },
    });
    const operation = await prisma.operation.create({
      data: {
        sessionId: session.id,
        status: "queued",
        requestText: "hello",
      },
    });
    const approval = await prisma.approval.create({
      data: {
        operationId: operation.id,
        kind: "commandExecution",
        status: "pending",
        prompt: "Allow command?",
      },
    });
    expect(approval.operationId).toBe(operation.id);
    await prisma.$disconnect();
  });
});
