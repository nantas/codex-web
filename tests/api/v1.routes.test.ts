import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { POST as createOperation } from "@/app/api/v1/operations/route";
import { OperationService } from "@/server/services/operation-service";

describe("POST /api/v1/operations", () => {
  it("returns 202 with operationId", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_1", githubId: "3001", email: "api@example.com", name: "API User" },
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

    const request = new Request("http://localhost/api/v1/operations", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "ses_1",
        type: "turn.start",
        input: [{ type: "text", text: "hello" }],
      }),
      headers: { "content-type": "application/json" },
    });
    const startExecutionSpy = vi
      .spyOn(OperationService.prototype, "startExecution")
      .mockImplementation(async (operationId: string) =>
        prisma.operation.findUniqueOrThrow({ where: { id: operationId } }),
      );
    const response = await createOperation(request);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.operationId).toBeTruthy();
    expect(body.status).toBe("running");
    expect(startExecutionSpy).toHaveBeenCalledWith(body.operationId);

    startExecutionSpy.mockRestore();
    await prisma.$disconnect();
  });
});
