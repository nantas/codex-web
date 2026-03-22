import { getRunnerGateway, type RunnerGateway, type TurnExecutionResult } from "@/server/codex/runner-gateway";
import { prisma } from "@/server/db/prisma";
import {
  OperationExecutionRegistry,
  type OperationExecutionHandle,
} from "@/server/services/operation-execution-registry";
import { OperationLogService } from "@/server/services/operation-log-service";

const operationLogService = new OperationLogService();
const executionRegistry = new OperationExecutionRegistry();

type OperationServiceDeps = {
  gateway: RunnerGateway;
  registry: OperationExecutionRegistry;
  operationLogs: OperationLogService;
};

export function createOperationServiceForTest(overrides: Partial<OperationServiceDeps> = {}) {
  return new OperationService({
    gateway: overrides.gateway ?? getRunnerGateway(),
    registry: overrides.registry ?? new OperationExecutionRegistry(),
    operationLogs: overrides.operationLogs ?? new OperationLogService(),
  });
}

export class OperationService {
  constructor(
    private readonly deps: OperationServiceDeps = {
      gateway: getRunnerGateway(),
      registry: executionRegistry,
      operationLogs: operationLogService,
    },
  ) {}

  async createQueued(input: { sessionId: string; requestText: string }) {
    const operation = await prisma.operation.create({
      data: {
        sessionId: input.sessionId,
        status: "queued",
        requestText: input.requestText,
      },
    });

    await this.deps.operationLogs.append(operation.id, {
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

    await this.deps.operationLogs.append(operation.id, { level: "info", message: "operation started" });
    return operation;
  }

  async startExecution(operationId: string) {
    const operation = await this.markRunning(operationId);
    void this.dispatchExecution(operationId);
    return operation;
  }

  async dispatchExecution(operationId: string) {
    try {
      const operation = await prisma.operation.findUnique({
        where: { id: operationId },
        include: { session: true },
      });

      if (!operation) {
        return;
      }

      if (!isExecutionActiveStatus(operation.status)) {
        return;
      }

      this.deps.registry.set({
        operationId: operation.id,
        sessionId: operation.sessionId,
        threadId: operation.session.threadId,
        workspaceId: operation.session.workspaceId,
        cwd: operation.session.cwd,
      });

      await this.deps.gateway.ensureRunner({
        workspaceId: operation.session.workspaceId,
        cwd: operation.session.cwd,
      });

      const result = await this.deps.gateway.startTurn({
        operationId: operation.id,
        workspaceId: operation.session.workspaceId,
        cwd: operation.session.cwd,
        sessionId: operation.sessionId,
        threadId: operation.session.threadId,
        text: operation.requestText,
      });

      if (!(await this.shouldApplyExecutionResult(operation.id))) {
        this.deps.registry.delete(operation.id);
        return;
      }

      await this.applyTurnResult(operation.id, result);

      if (result.status !== "running" && result.status !== "waitingApproval") {
        this.deps.registry.delete(operation.id);
      }
    } catch (error) {
      await this.failOperation(operationId, toErrorMessage(error));
      this.deps.registry.delete(operationId);
    }
  }

  async requireApproval(operationId: string, input: { kind: string; prompt: string }) {
    await prisma.operation.update({
      where: { id: operationId },
      data: { status: "waitingApproval" },
    });
    await this.deps.operationLogs.append(operationId, {
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

  async resumeAfterApproval(input: {
    operationId: string;
    approvalId: string;
    decision: "approve" | "deny";
  }) {
    const handle = await this.getOrCreateHandle(input.operationId);
    if (!handle) {
      throw new Error(`Operation not found: ${input.operationId}`);
    }

    await this.deps.gateway.ensureRunner({ workspaceId: handle.workspaceId, cwd: handle.cwd });
    const result = await this.deps.gateway.resumeAfterApproval(input);

    if (!(await this.shouldApplyExecutionResult(input.operationId))) {
      this.deps.registry.delete(input.operationId);
      return;
    }

    await this.applyTurnResult(input.operationId, result);

    if (result.status !== "running" && result.status !== "waitingApproval") {
      this.deps.registry.delete(input.operationId);
    }
  }

  async interruptExecution(operationId: string) {
    const operation = await prisma.operation.findUnique({ where: { id: operationId } });
    if (!operation) {
      return null;
    }

    if (isExecutionTerminalStatus(operation.status)) {
      this.deps.registry.delete(operationId);
      return operation;
    }

    await this.deps.gateway.interruptTurn({ operationId });
    const updated = await prisma.operation.update({
      where: { id: operationId },
      data: { status: "interrupted" },
    });
    await this.deps.operationLogs.append(updated.id, {
      level: "error",
      message: "operation interrupted",
    });
    this.deps.registry.delete(operationId);
    return updated;
  }

  async getById(operationId: string) {
    return prisma.operation.findUnique({ where: { id: operationId } });
  }

  private async getOrCreateHandle(operationId: string): Promise<OperationExecutionHandle | null> {
    const cached = this.deps.registry.get(operationId);
    if (cached) {
      return cached;
    }

    const operation = await prisma.operation.findUnique({
      where: { id: operationId },
      include: { session: true },
    });

    if (!operation) {
      return null;
    }

    const handle: OperationExecutionHandle = {
      operationId: operation.id,
      sessionId: operation.sessionId,
      threadId: operation.session.threadId,
      workspaceId: operation.session.workspaceId,
      cwd: operation.session.cwd,
    };

    this.deps.registry.set(handle);
    return handle;
  }

  private async applyTurnResult(operationId: string, result: TurnExecutionResult) {
    if (result.status === "completed") {
      await prisma.operation.update({
        where: { id: operationId },
        data: { status: "completed", resultText: result.resultText, errorMessage: null },
      });
      await this.deps.operationLogs.append(operationId, {
        level: "info",
        message: `operation completed: ${result.resultText}`,
      });
      return;
    }

    if (result.status === "failed") {
      await this.failOperation(operationId, result.errorMessage);
      return;
    }

    if (result.status === "waitingApproval") {
      await this.requireApproval(operationId, {
        kind: result.kind,
        prompt: result.prompt,
      });
      return;
    }

    await this.deps.operationLogs.append(operationId, {
      level: "info",
      message: "operation is running",
    });
  }

  private async failOperation(operationId: string, errorMessage: string) {
    await prisma.operation.update({
      where: { id: operationId },
      data: { status: "failed", errorMessage },
    });
    await this.deps.operationLogs.append(operationId, {
      level: "error",
      message: `operation failed: ${errorMessage}`,
    });
  }

  private async shouldApplyExecutionResult(operationId: string) {
    const current = await prisma.operation.findUnique({
      where: { id: operationId },
      select: { status: true },
    });
    if (!current) {
      return false;
    }

    return !isExecutionTerminalStatus(current.status);
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown execution error";
}

function isExecutionActiveStatus(status: string) {
  return status === "running" || status === "waitingApproval";
}

function isExecutionTerminalStatus(status: string) {
  return status === "completed" || status === "failed" || status === "interrupted";
}
