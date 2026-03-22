import { prisma } from "@/server/db/prisma";
import { OperationLogService } from "@/server/services/operation-log-service";

const operationLogService = new OperationLogService();

export function createOperationServiceForTest() {
  return new OperationService();
}

export class OperationService {
  async createQueued(input: { sessionId: string; requestText: string }) {
    const operation = await prisma.operation.create({
      data: {
        sessionId: input.sessionId,
        status: "queued",
        requestText: input.requestText,
      },
    });

    await operationLogService.append(operation.id, {
      level: "info",
      message: `queued request: ${input.requestText}`,
    });

    return operation;
  }

  async markRunning(operationId: string) {
    const operation = await prisma.operation.update({
      where: { id: operationId },
      data: { status: "running" },
    });

    await operationLogService.append(operation.id, { level: "info", message: "operation started" });
    return operation;
  }

  async requireApproval(operationId: string, input: { kind: string; prompt: string }) {
    await prisma.operation.update({
      where: { id: operationId },
      data: { status: "waitingApproval" },
    });
    await operationLogService.append(operationId, {
      level: "info",
      message: `waiting approval (${input.kind}): ${input.prompt}`,
    });

    return prisma.approval.create({
      data: {
        operationId,
        kind: input.kind,
        status: "pending",
        prompt: input.prompt,
      },
    });
  }

  async getById(operationId: string) {
    return prisma.operation.findUnique({ where: { id: operationId } });
  }
}
