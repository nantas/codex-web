import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { POST as interruptOperation } from "@/app/api/v1/operations/[operationId]/interrupt/route";

describe("POST /api/v1/operations/[operationId]/interrupt", () => {
  it("interrupts active operation", async () => {
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

    const response = await interruptOperation(
      new Request("http://localhost/api/v1/operations/op_int_1/interrupt", {
        method: "POST",
      }),
      { params: Promise.resolve({ operationId: "op_int_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ operationId: "op_int_1", status: "interrupted" });

    const operation = await prisma.operation.findUnique({ where: { id: "op_int_1" } });
    expect(operation?.status).toBe("interrupted");

    const logs = await prisma.operationLog.findMany({
      where: { operationId: "op_int_1" },
      orderBy: { id: "asc" },
    });
    expect(logs.some((log) => log.message === "operation interrupted")).toBe(true);

    await prisma.$disconnect();
  });

  it("does not change terminal operation status", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_int_2", githubId: "8002", email: "int2@example.com", name: "Interrupt User 2" },
    });

    await prisma.session.create({
      data: {
        id: "ses_int_2",
        userId: "usr_int_2",
        workspaceId: "ws-int-2",
        cwd: "/tmp/ws-int-2",
        threadId: "thr_int_2",
        status: "running",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_int_2",
        sessionId: "ses_int_2",
        status: "completed",
        requestText: "done",
        resultText: "done",
      },
    });

    const response = await interruptOperation(
      new Request("http://localhost/api/v1/operations/op_int_2/interrupt", {
        method: "POST",
      }),
      { params: Promise.resolve({ operationId: "op_int_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ operationId: "op_int_2", status: "completed" });

    const operation = await prisma.operation.findUnique({ where: { id: "op_int_2" } });
    expect(operation?.status).toBe("completed");

    const logs = await prisma.operationLog.findMany({
      where: { operationId: "op_int_2" },
      orderBy: { id: "asc" },
    });
    expect(logs.some((log) => log.message === "operation interrupted")).toBe(false);

    await prisma.$disconnect();
  });
});
