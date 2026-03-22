import { NextResponse } from "next/server";
import { approvalDecisionRequestSchema } from "@/server/contracts/api";
import { prisma } from "@/server/db/prisma";
import { HttpError, toErrorResponse } from "@/server/http/errors";
import { OperationLogService } from "@/server/services/operation-log-service";
import { OperationService } from "@/server/services/operation-service";

const operationLogService = new OperationLogService();
const operationService = new OperationService();

export async function POST(
  req: Request,
  context: { params: Promise<{ approvalId: string }> },
) {
  try {
    const parsed = approvalDecisionRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new HttpError(400, "Invalid approval decision payload");
    }

    const { approvalId } = await context.params;

    const approval = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        decision: parsed.data.decision,
        status: parsed.data.decision === "approve" ? "approved" : "denied",
      },
    });

    await prisma.operation.update({
      where: { id: approval.operationId },
      data: { status: parsed.data.decision === "approve" ? "running" : "failed" },
    });
    await operationLogService.append(approval.operationId, {
      level: parsed.data.decision === "approve" ? "info" : "error",
      message:
        parsed.data.decision === "approve"
          ? `approval ${approval.id} approved`
          : `approval ${approval.id} denied`,
    });
    if (parsed.data.decision === "approve") {
      await operationService.resumeAfterApproval({
        operationId: approval.operationId,
        approvalId: approval.id,
        decision: "approve",
      });
    }

    return NextResponse.json({ approvalId: approval.id, status: approval.status });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return toErrorResponse(new HttpError(404, "Approval not found"));
    }

    return toErrorResponse(error);
  }
}
