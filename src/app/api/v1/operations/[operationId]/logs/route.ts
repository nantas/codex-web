import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { HttpError, toErrorResponse } from "@/server/http/errors";
import { OperationLogService } from "@/server/services/operation-log-service";

const operationLogService = new OperationLogService();

export async function GET(
  req: Request,
  context: { params: Promise<{ operationId: string }> },
) {
  try {
    const { operationId } = await context.params;
    const operation = await prisma.operation.findUnique({
      where: { id: operationId },
      select: { id: true },
    });

    if (!operation) {
      throw new HttpError(404, "Operation not found");
    }

    const url = new URL(req.url);
    const after = Number(url.searchParams.get("after") ?? "0");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const levelParam = url.searchParams.get("level");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const level = levelParam === null ? undefined : levelParam;
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;

    if (
      !Number.isFinite(after) ||
      after < 0 ||
      !Number.isFinite(limit) ||
      limit <= 0 ||
      (level !== undefined && level !== "info" && level !== "error") ||
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime())) ||
      (from && to && from > to)
    ) {
      throw new HttpError(400, "Invalid logs query");
    }

    const { logs, nextCursor } = await operationLogService.list(operationId, {
      afterId: after,
      limit,
      level: level as "info" | "error" | undefined,
      from,
      to,
    });

    return NextResponse.json({ operationId, logs, nextCursor });
  } catch (error) {
    return toErrorResponse(error);
  }
}
