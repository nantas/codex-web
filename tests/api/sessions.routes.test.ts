import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { GET as getSessionDetail } from "@/app/api/v1/sessions/[sessionId]/route";
import { GET as listSessions } from "@/app/api/v1/sessions/route";

describe("GET /api/v1/sessions and /api/v1/sessions/[sessionId]", () => {
  it("returns real sessions list with pending approval count and latest operation", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_1", githubId: "4001", email: "list@example.com", name: "List User" },
    });

    await prisma.session.create({
      data: {
        id: "ses_1",
        userId: "usr_1",
        workspaceId: "ws-1",
        cwd: "/tmp/workspace-1",
        threadId: "thr_1",
        status: "running",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_1",
        sessionId: "ses_1",
        status: "waitingApproval",
        requestText: "run dangerous cmd",
        approvals: {
          create: [{ id: "apr_1", kind: "commandExecution", status: "pending", prompt: "Approve?" }],
        },
      },
    });

    const response = await listSessions();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).toMatchObject({
      id: "ses_1",
      status: "running",
      workspaceId: "ws-1",
      pendingApprovals: 1,
      latestOperation: {
        id: "op_1",
        status: "waitingApproval",
      },
    });

    await prisma.$disconnect();
  });

  it("returns session detail with operations and approvals", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_2", githubId: "4002", email: "detail@example.com", name: "Detail User" },
    });

    await prisma.session.create({
      data: {
        id: "ses_2",
        userId: "usr_2",
        workspaceId: "ws-2",
        cwd: "/tmp/workspace-2",
        threadId: "thr_2",
        status: "idle",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_2",
        sessionId: "ses_2",
        status: "completed",
        requestText: "echo hello",
        resultText: "hello",
        approvals: {
          create: [{ id: "apr_2", kind: "commandExecution", status: "approved", prompt: "Approve?" }],
        },
      },
    });

    const response = await getSessionDetail(new Request("http://localhost/api/v1/sessions/ses_2"), {
      params: Promise.resolve({ sessionId: "ses_2" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session).toMatchObject({ id: "ses_2", workspaceId: "ws-2", status: "idle" });
    expect(body.operations).toHaveLength(1);
    expect(body.operations[0]).toMatchObject({
      id: "op_2",
      status: "completed",
      resultText: "hello",
      approvals: [{ id: "apr_2", status: "approved" }],
    });

    await prisma.$disconnect();
  });
});
