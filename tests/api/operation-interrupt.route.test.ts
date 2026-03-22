import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { POST as interruptOperation } from "@/app/api/v1/operations/[operationId]/interrupt/route";
import { OperationService } from "@/server/services/operation-service";

describe("POST /api/v1/operations/[operationId]/interrupt", () => {
  it("interrupts operation and calls execution interruption", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_int_1", githubId: "8001", email: "int@example.com", name: "Interrupt User" },
    });

    await prisma.session.create({
      data: {
        id: "ses_int_1",
        userId: "usr_int_1",
        workspaceId: "ws-int-1",
        cwd: "/tmp/ws-int-1",
        threadId: "thr_int_1",
        status: "running",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_int_1",
        sessionId: "ses_int_1",
        status: "running",
        requestText: "sleep 100",
      },
    });

    const interruptSpy = vi.spyOn(OperationService.prototype, "interruptExecution").mockResolvedValue();
    try {
      const response = await interruptOperation(
        new Request("http://localhost/api/v1/operations/op_int_1/interrupt", {
          method: "POST",
        }),
        { params: Promise.resolve({ operationId: "op_int_1" }) },
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ operationId: "op_int_1", status: "interrupted" });
      expect(interruptSpy).toHaveBeenCalledWith("op_int_1");

      const operation = await prisma.operation.findUnique({ where: { id: "op_int_1" } });
      expect(operation?.status).toBe("interrupted");
    } finally {
      interruptSpy.mockRestore();
      await prisma.$disconnect();
    }
  });
});
