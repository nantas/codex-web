import { prisma } from "@/server/db/prisma";

export function createOperationServiceForTest() {
  return new OperationService();
}

export class OperationService {
  async createQueued(input: { sessionId: string; requestText: string }) {
    return prisma.operation.create({
      data: {
        sessionId: input.sessionId,
        status: "queued",
        requestText: input.requestText,
      },
    });
  }

  async markRunning(operationId: string) {
    return prisma.operation.update({
      where: { id: operationId },
      data: { status: "running" },
    });
  }

  async requireApproval(operationId: string, input: { kind: string; prompt: string }) {
    await prisma.operation.update({
      where: { id: operationId },
      data: { status: "waitingApproval" },
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
