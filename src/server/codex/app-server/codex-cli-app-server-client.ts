import {
  AppServerClientError,
  type AppServerClient,
  type AppServerInterruptInput,
  type AppServerProcessMeta,
  type AppServerResumeInput,
  type AppServerTurnInput,
} from "@/server/codex/app-server/client";
import {
  type AppServerTurnApprovalRequiredEvent,
  type AppServerTurnCompletedEvent,
  type AppServerTurnEvent,
  type AppServerTurnRunningEvent,
} from "@/server/codex/app-server/protocol";
import { AppServerProcessManager } from "@/server/codex/app-server/process-manager";

export class CodexCliAppServerClient implements AppServerClient {
  constructor(private readonly processManager = new AppServerProcessManager()) {}

  async isAvailable() {
    return process.env.CODEX_APP_SERVER_ENABLED !== "0";
  }

  async ensureProcess(input: { workspaceId: string; cwd: string }): Promise<AppServerProcessMeta | null> {
    if (!(await this.isAvailable())) {
      return null;
    }

    return this.processManager.getOrStart(input.workspaceId, { cwd: input.cwd });
  }

  async startTurn(input: AppServerTurnInput): Promise<AppServerTurnEvent> {
    await this.ensureProcessOrThrow(input.workspaceId, input.cwd);

    const response = await this.processManager.sendRequest({
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      method: "turn.start",
      params: {
        operationId: input.operationId,
        sessionId: input.sessionId,
        threadId: input.threadId,
        text: input.text,
      },
    });

    return normalizeTurnEvent(response);
  }

  async resumeAfterApproval(input: AppServerResumeInput): Promise<AppServerTurnEvent> {
    await this.ensureProcessOrThrow(input.workspaceId, input.cwd);

    const response = await this.processManager.sendRequest({
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      method: "turn.resume",
      params: {
        operationId: input.operationId,
        approvalId: input.approvalId,
        decision: input.decision,
        continuationToken: input.continuationToken,
      },
    });

    return normalizeTurnEvent(response);
  }

  async interruptTurn(input: AppServerInterruptInput): Promise<void> {
    await this.ensureProcessOrThrow(input.workspaceId, input.cwd);

    await this.processManager.sendRequest({
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      method: "turn.interrupt",
      params: {
        operationId: input.operationId,
        turnId: input.turnId,
      },
    });
  }

  private async ensureProcessOrThrow(workspaceId: string, cwd: string) {
    const processMeta = await this.ensureProcess({ workspaceId, cwd });
    if (!processMeta) {
      throw new AppServerClientError("unavailable", "app-server disabled by configuration");
    }

    return processMeta;
  }
}

function normalizeTurnEvent(input: unknown): AppServerTurnEvent {
  if (!isObjectRecord(input)) {
    throw new AppServerClientError("protocol", "app-server response is not an object");
  }

  const type = input.type;
  const id = input.id;
  if (typeof type !== "string" || typeof id !== "string") {
    throw new AppServerClientError("protocol", "app-server event missing type/id");
  }

  if (type === "turn.completed") {
    const outputText = input.outputText;
    if (typeof outputText !== "string") {
      throw new AppServerClientError("protocol", "turn.completed missing outputText");
    }

    const event: AppServerTurnCompletedEvent = {
      id,
      type,
      outputText,
    };
    return event;
  }

  if (type === "turn.approval_required") {
    const kind = input.kind;
    const prompt = input.prompt;
    if (typeof kind !== "string" || typeof prompt !== "string") {
      throw new AppServerClientError("protocol", "turn.approval_required missing kind/prompt");
    }

    const continuationToken =
      typeof input.continuationToken === "string" ? input.continuationToken : undefined;

    const event: AppServerTurnApprovalRequiredEvent = {
      id,
      type,
      kind,
      prompt,
      continuationToken,
    };
    return event;
  }

  if (type === "turn.running") {
    const event: AppServerTurnRunningEvent = {
      id,
      type,
    };
    return event;
  }

  throw new AppServerClientError("protocol", `unsupported app-server event type: ${type}`);
}

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
