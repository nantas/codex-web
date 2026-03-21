import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { HttpError, toErrorResponse } from "@/server/http/errors";

export async function POST(
  _req: Request,
  context: { params: Promise<{ operationId: string }> },
) {
  try {
    const { operationId } = await context.params;
    const operation = await prisma.operation.update({
      where: { id: operationId },
      data: { status: "interrupted" },
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
