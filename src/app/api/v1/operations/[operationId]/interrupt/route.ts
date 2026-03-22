import { NextResponse } from "next/server";
import { HttpError, toErrorResponse } from "@/server/http/errors";
import { OperationService } from "@/server/services/operation-service";

const operationService = new OperationService();

export async function POST(
  _req: Request,
  context: { params: Promise<{ operationId: string }> },
) {
  try {
    const { operationId } = await context.params;
    const operation = await operationService.interruptExecution(operationId);
    if (!operation) {
      throw new HttpError(404, "Operation not found");
    }

    return NextResponse.json({ operationId: operation.id, status: operation.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
