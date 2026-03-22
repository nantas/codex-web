import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { POST as decideApproval } from "@/app/api/v1/approvals/[approvalId]/decision/route";
import { OperationService } from "@/server/services/operation-service";

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

    const resumeSpy = vi.spyOn(OperationService.prototype, "resumeAfterApproval").mockResolvedValue();
    try {
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
      expect(resumeSpy).toHaveBeenCalledWith({
        operationId: "op_9",
        approvalId: "apr_9",
        decision: "approve",
      });

      const approval = await prisma.approval.findUnique({ where: { id: "apr_9" } });
      const operation = await prisma.operation.findUnique({ where: { id: "op_9" } });

      expect(approval?.status).toBe("approved");
      expect(approval?.decision).toBe("approve");
      expect(operation?.status).toBe("running");
    } finally {
      resumeSpy.mockRestore();
      await prisma.$disconnect();
    }
  });

  it("denies pending approval and triggers protocol cleanup", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_10", githubId: "9002", email: "approval2@example.com", name: "Approval User 2" },
    });

    await prisma.session.create({
      data: {
        id: "ses_10",
        userId: "usr_10",
        workspaceId: "ws-10",
        cwd: "/tmp/ws-10",
        threadId: "thr_10",
        status: "running",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_10",
        sessionId: "ses_10",
        status: "waitingApproval",
        requestText: "dangerous command",
        approvals: {
          create: [
            {
              id: "apr_10",
              kind: "commandExecution",
              status: "pending",
              prompt: "Approve command?",
            },
          ],
        },
      },
    });

    const resumeSpy = vi.spyOn(OperationService.prototype, "resumeAfterApproval").mockResolvedValue();
    try {
      const response = await decideApproval(
        new Request("http://localhost/api/v1/approvals/apr_10/decision", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision: "deny" }),
        }),
        { params: Promise.resolve({ approvalId: "apr_10" }) },
      );

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ approvalId: "apr_10", status: "denied" });
      expect(resumeSpy).toHaveBeenCalledWith({
        operationId: "op_10",
        approvalId: "apr_10",
        decision: "deny",
      });

      const approval = await prisma.approval.findUnique({ where: { id: "apr_10" } });
      const operation = await prisma.operation.findUnique({ where: { id: "op_10" } });

      expect(approval?.status).toBe("denied");
      expect(approval?.decision).toBe("deny");
      expect(operation?.status).toBe("failed");
    } finally {
      resumeSpy.mockRestore();
      await prisma.$disconnect();
    }
  });

  it("keeps deny response successful when protocol cleanup fails", async () => {
    const prisma = new PrismaClient();
    await prisma.approval.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: "usr_11", githubId: "9003", email: "approval3@example.com", name: "Approval User 3" },
    });

    await prisma.session.create({
      data: {
        id: "ses_11",
        userId: "usr_11",
        workspaceId: "ws-11",
        cwd: "/tmp/ws-11",
        threadId: "thr_11",
        status: "running",
      },
    });

    await prisma.operation.create({
      data: {
        id: "op_11",
        sessionId: "ses_11",
        status: "waitingApproval",
        requestText: "dangerous command",
        approvals: {
          create: [
            {
              id: "apr_11",
              kind: "commandExecution",
              status: "pending",
              prompt: "Approve command?",
            },
          ],
        },
      },
    });

    const resumeSpy = vi
      .spyOn(OperationService.prototype, "resumeAfterApproval")
      .mockRejectedValue(new Error("protocol link closed"));
    try {
      const response = await decideApproval(
        new Request("http://localhost/api/v1/approvals/apr_11/decision", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision: "deny" }),
        }),
        { params: Promise.resolve({ approvalId: "apr_11" }) },
      );

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ approvalId: "apr_11", status: "denied" });
      expect(resumeSpy).toHaveBeenCalledWith({
        operationId: "op_11",
        approvalId: "apr_11",
        decision: "deny",
      });

      const logs = await prisma.operationLog.findMany({
        where: { operationId: "op_11" },
        orderBy: { id: "asc" },
      });

      expect(logs.some((item) => item.message.includes("deny protocol cleanup failed"))).toBe(true);
    } finally {
      resumeSpy.mockRestore();
      await prisma.$disconnect();
    }
  });
});
