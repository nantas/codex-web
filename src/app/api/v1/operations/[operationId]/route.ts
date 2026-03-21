import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { HttpError, toErrorResponse } from "@/server/http/errors";

export async function GET(
  _req: Request,
  context: { params: Promise<{ operationId: string }> },
) {
  try {
    const { operationId } = await context.params;
    const operation = await prisma.operation.findUnique({
      where: { id: operationId },
      include: { approvals: true },
    });

    if (!operation) {
      throw new HttpError(404, "Operation not found");
    }

    return NextResponse.json({
      operationId: operation.id,
      status: operation.status,
      resultText: operation.resultText,
      errorMessage: operation.errorMessage,
      approvals: operation.approvals,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
