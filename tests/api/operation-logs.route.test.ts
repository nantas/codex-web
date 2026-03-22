import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { GET as getLogs } from "@/app/api/v1/operations/[operationId]/logs/route";
import { POST as createOperation } from "@/app/api/v1/operations/route";

describe("GET /api/v1/operations/[operationId]/logs", () => {
  it("returns operation logs with cursor", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_l1", githubId: "7101", email: "logs@example.com", name: "Logs User" },
    });

    await prisma.session.create({
      data: {
        id: "ses_l1",
        userId: "usr_l1",
        workspaceId: "ws-l1",
        cwd: "/tmp/ws-l1",
        threadId: "thr_l1",
        status: "idle",
      },
    });

    const createRes = await createOperation(
      new Request("http://localhost/api/v1/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "ses_l1",
          type: "turn.start",
          input: [{ type: "text", text: "echo hi" }],
        }),
      }),
    );
    const createBody = await createRes.json();

    const response = await getLogs(new Request("http://localhost/api/v1/operations/op/logs"), {
      params: Promise.resolve({ operationId: createBody.operationId as string }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.operationId).toBe(createBody.operationId);
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.logs.length).toBeGreaterThan(0);
    expect(body.logs[0]).toMatchObject({ level: "info" });
    expect(typeof body.nextCursor).toBe("number");

    await prisma.$disconnect();
  });

  it("supports filtering by level and time range", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_l2", githubId: "7102", email: "logs2@example.com", name: "Logs User 2" },
    });

    await prisma.session.create({
      data: {
        id: "ses_l2",
        userId: "usr_l2",
        workspaceId: "ws-l2",
        cwd: "/tmp/ws-l2",
        threadId: "thr_l2",
        status: "idle",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_l2",
        sessionId: "ses_l2",
        status: "running",
        requestText: "echo hi2",
      },
    });

    await prisma.operationLog.createMany({
      data: [
        {
          operationId: "op_l2",
          level: "info",
          message: "info old",
          createdAt: new Date("2026-03-21T00:00:00.000Z"),
        },
        {
          operationId: "op_l2",
          level: "error",
          message: "error mid",
          createdAt: new Date("2026-03-21T00:05:00.000Z"),
        },
      ],
    });

    const response = await getLogs(
      new Request(
        "http://localhost/api/v1/operations/op_l2/logs?level=error&from=2026-03-21T00:04:00.000Z&to=2026-03-21T00:06:00.000Z",
      ),
      {
        params: Promise.resolve({ operationId: "op_l2" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0].message).toBe("error mid");

    await prisma.$disconnect();
  });

  it("returns 400 for invalid filter query", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_l3", githubId: "7103", email: "logs3@example.com", name: "Logs User 3" },
    });
    await prisma.session.create({
      data: {
        id: "ses_l3",
        userId: "usr_l3",
        workspaceId: "ws-l3",
        cwd: "/tmp/ws-l3",
        threadId: "thr_l3",
        status: "idle",
      },
    });
    await prisma.operation.create({
      data: {
        id: "op_l3",
        sessionId: "ses_l3",
        status: "running",
        requestText: "echo hi3",
      },
    });

    const response = await getLogs(
      new Request("http://localhost/api/v1/operations/op_l3/logs?level=warn"),
      {
        params: Promise.resolve({ operationId: "op_l3" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid logs query");

    await prisma.$disconnect();
  });
});
