import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { POST as decideApproval } from "@/app/api/v1/approvals/[approvalId]/decision/route";

describe("POST /api/v1/approvals/[approvalId]/decision", () => {
  it("approves pending approval and moves operation back to running", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_9", githubId: "9001", email: "approval@example.com", name: "Approval User" },
    });

    await prisma.session.create({
      data: {
        id: "ses_9",
        userId: "usr_9",
        workspaceId: "ws-9",
        cwd: "/tmp/ws-9",
        threadId: "thr_9",
        status: "running",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_9",
        sessionId: "ses_9",
        status: "waitingApproval",
        requestText: "dangerous command",
        approvals: {
          create: [
            {
              id: "apr_9",
              kind: "commandExecution",
              status: "pending",
              prompt: "Approve command?",
            },
          ],
        },
      },
    });

    const response = await decideApproval(
      new Request("http://localhost/api/v1/approvals/apr_9/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
      { params: Promise.resolve({ approvalId: "apr_9" }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ approvalId: "apr_9", status: "approved" });

    const approval = await prisma.approval.findUnique({ where: { id: "apr_9" } });
    const operation = await prisma.operation.findUnique({ where: { id: "op_9" } });

    expect(approval?.status).toBe("approved");
    expect(approval?.decision).toBe("approve");
    expect(operation?.status).toBe("running");

    await prisma.$disconnect();
  });
});
