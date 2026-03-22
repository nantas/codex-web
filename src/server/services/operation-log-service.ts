import { prisma } from "@/server/db/prisma";

export type OperationLogLevel = "info" | "error";

export type OperationLogView = {
  id: number;
  operationId: string;
  level: OperationLogLevel;
  message: string;
  timestamp: string;
};

function toLogView(log: {
  id: number;
  operationId: string;
  level: string;
  message: string;
  createdAt: Date;
}): OperationLogView {
  return {
    id: log.id,
    operationId: log.operationId,
    level: log.level === "error" ? "error" : "info",
    message: log.message,
    timestamp: log.createdAt.toISOString(),
  };
}

export class OperationLogService {
  async append(operationId: string, input: { level: OperationLogLevel; message: string }) {
    const created = await prisma.operationLog.create({
      data: {
        operationId,
        level: input.level,
        message: input.message,
      },
    });

    return toLogView(created);
  }

  async list(
    operationId: string,
    options: {
      afterId?: number;
      limit?: number;
      level?: OperationLogLevel;
      from?: Date;
      to?: Date;
    } = {},
  ) {
    const afterId = options.afterId ?? 0;
    const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
    const createdAtFilter =
      options.from || options.to
        ? {
            ...(options.from ? { gte: options.from } : {}),
            ...(options.to ? { lte: options.to } : {}),
          }
        : undefined;
    const logs = await prisma.operationLog.findMany({
      where: {
        operationId,
        id: { gt: afterId },
        ...(options.level ? { level: options.level } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      orderBy: { id: "asc" },
      take: limit,
    });
    const mapped = logs.map(toLogView);
    const nextCursor = mapped.length > 0 ? mapped[mapped.length - 1].id : afterId;
    return { logs: mapped, nextCursor };
  }

  async listRecent(operationId: string, limit = 20) {
    const logs = await prisma.operationLog.findMany({
      where: { operationId },
      orderBy: { id: "desc" },
      take: Math.max(1, Math.min(limit, 200)),
    });
    return logs.reverse().map(toLogView);
  }
}
