import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { HttpError, toErrorResponse } from "@/server/http/errors";
import { OperationLogService } from "@/server/services/operation-log-service";
import { OperationService } from "@/server/services/operation-service";

const operationLogService = new OperationLogService();
const operationService = new OperationService();

export async function POST(
  _req: Request,
  context: { params: Promise<{ operationId: string }> },
) {
  try {
    const { operationId } = await context.params;
    await operationService.interruptExecution(operationId);
    const operation = await prisma.operation.update({
      where: { id: operationId },
      data: { status: "interrupted" },
    });
    await operationLogService.append(operation.id, {
      level: "error",
      message: "operation interrupted",
    });

    return NextResponse.json({ operationId: operation.id, status: operation.status });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return toErrorResponse(new HttpError(404, "Operation not found"));
    }

    return toErrorResponse(error);
  }
}
