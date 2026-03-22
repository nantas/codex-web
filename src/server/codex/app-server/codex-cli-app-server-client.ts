import {
  AppServerClientError,
  isAppServerClientError,
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

const MODERN_TURN_TIMEOUT_MS = 120_000;
const TURN_POLL_INTERVAL_MS = 300;

type ModernTurn = {
  id: string;
  status: string;
  error?: unknown;
  items?: unknown;
  approvalKind?: string;
  approvalPrompt?: string;
  continuationToken?: string;
};

type ModernApprovalNotification = {
  kind: string;
  prompt: string;
  continuationToken?: string;
};

export class CodexCliAppServerClient implements AppServerClient {
  private readonly initializedWorkspaces = new Set<string>();
  private readonly threadIdByLogicalThread = new Map<string, string>();
  private readonly threadIdByOperationId = new Map<string, string>();

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

    const modern = await this.tryStartTurnModern(input);
    if (modern) {
      return modern;
    }

    return this.startTurnLegacyOrUnavailable(input);
  }

  async resumeAfterApproval(input: AppServerResumeInput): Promise<AppServerTurnEvent> {
    await this.ensureProcessOrThrow(input.workspaceId, input.cwd);

    try {
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
    } catch (error) {
      if (isCapabilityMismatch(error)) {
        throw new AppServerClientError(
          "unavailable",
          "installed codex app-server does not support legacy resume method",
        );
      }
      throw error;
    }
  }

  async interruptTurn(input: AppServerInterruptInput): Promise<void> {
    await this.ensureProcessOrThrow(input.workspaceId, input.cwd);

    const modernThreadId = this.threadIdByOperationId.get(input.operationId);
    if (modernThreadId) {
      try {
        await this.processManager.sendRequest({
          workspaceId: input.workspaceId,
          cwd: input.cwd,
          method: "turn/interrupt",
          params: {
            threadId: modernThreadId,
            turnId: input.turnId,
          },
        });
        return;
      } catch (error) {
        if (!isCapabilityMismatch(error)) {
          throw error;
        }
      }
    }

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

  private async tryStartTurnModern(input: AppServerTurnInput): Promise<AppServerTurnEvent | null> {
    try {
      return await this.startTurnModern(input);
    } catch (error) {
      if (isCapabilityMismatch(error)) {
        return null;
      }
      throw error;
    }
  }

  private async startTurnLegacyOrUnavailable(input: AppServerTurnInput): Promise<AppServerTurnEvent> {
    try {
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
    } catch (error) {
      if (isCapabilityMismatch(error)) {
        throw new AppServerClientError(
          "unavailable",
          "installed codex app-server does not support known start methods",
        );
      }
      throw error;
    }
  }

  private async startTurnModern(input: AppServerTurnInput): Promise<AppServerTurnEvent> {
    await this.ensureModernInitialized(input.workspaceId, input.cwd);
    const threadId = await this.getModernThreadId(input.workspaceId, input.threadId, input.cwd);

    const started = await this.processManager.sendRequest({
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      method: "turn/start",
      params: {
        threadId,
        input: [{ type: "text", text: input.text }],
      },
    });

    const startedTurn = extractModernTurnFromStart(started);
    this.threadIdByOperationId.set(input.operationId, threadId);

    if (!isRunningStatus(startedTurn.status)) {
      return mapModernTurnToAppServerEvent(startedTurn);
    }

    const completed = await this.waitForModernTurnCompletion({
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      threadId,
      turnId: startedTurn.id,
      timeoutMs: MODERN_TURN_TIMEOUT_MS,
    });

    return mapModernTurnToAppServerEvent(completed);
  }

  private async ensureModernInitialized(workspaceId: string, cwd: string) {
    if (this.initializedWorkspaces.has(workspaceId)) {
      return;
    }

    try {
      await this.processManager.sendRequest({
        workspaceId,
        cwd,
        method: "initialize",
        params: {
          clientInfo: {
            name: "codex-web",
            version: "0.1.0",
          },
        },
      });
      this.initializedWorkspaces.add(workspaceId);
    } catch (error) {
      if (isAppServerClientError(error) && error.code === "execution") {
        const lower = error.message.toLowerCase();
        if (lower.includes("already initialized")) {
          this.initializedWorkspaces.add(workspaceId);
          return;
        }
      }

      throw error;
    }
  }

  private async getModernThreadId(workspaceId: string, logicalThreadId: string, cwd: string) {
    const key = `${workspaceId}:${logicalThreadId}`;
    const existing = this.threadIdByLogicalThread.get(key);
    if (existing) {
      return existing;
    }

    const response = await this.processManager.sendRequest({
      workspaceId,
      cwd,
      method: "thread/start",
      params: {
        cwd,
      },
    });

    const threadId = extractThreadIdFromThreadStart(response);
    this.threadIdByLogicalThread.set(key, threadId);
    return threadId;
  }

  private async waitForModernTurnCompletion(input: {
    workspaceId: string;
    cwd: string;
    threadId: string;
    turnId: string;
    timeoutMs: number;
  }): Promise<ModernTurn> {
    const deadline = Date.now() + input.timeoutMs;
    const approvalNotificationPromise = this.waitForModernApprovalNotification({
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      threadId: input.threadId,
      turnId: input.turnId,
      timeoutMs: input.timeoutMs,
    }).catch(() => null);

    while (Date.now() <= deadline) {
      let response: unknown;
      try {
        response = await this.processManager.sendRequest({
          workspaceId: input.workspaceId,
          cwd: input.cwd,
          method: "thread/read",
          params: {
            threadId: input.threadId,
            includeTurns: true,
          },
        });
      } catch (error) {
        if (isTransientThreadReadState(error)) {
          await waitForApprovalOrInterval(approvalNotificationPromise, deadline);
          continue;
        }
        throw error;
      }

      const snapshot = findTurnSnapshotById(response, input.turnId);
      if (!snapshot.turn) {
        await waitForApprovalOrInterval(approvalNotificationPromise, deadline);
        continue;
      }

      if (snapshot.waitingOnApproval && isRunningStatus(snapshot.turn.status)) {
        return {
          ...snapshot.turn,
          status: "approval_required",
          approvalKind: "commandExecution",
          approvalPrompt: "Codex app-server requires approval to continue.",
        };
      }

      if (!isRunningStatus(snapshot.turn.status)) {
        return snapshot.turn;
      }

      const approvalNotification = await waitForApprovalOrInterval(
        approvalNotificationPromise,
        deadline,
      );
      if (approvalNotification) {
        return {
          ...snapshot.turn,
          status: "approval_required",
          approvalKind: approvalNotification.kind,
          approvalPrompt: approvalNotification.prompt,
          continuationToken: approvalNotification.continuationToken,
        };
      }
    }

    throw new AppServerClientError("timeout", "waiting for modern app-server turn completion timed out");
  }

  private async waitForModernApprovalNotification(input: {
    workspaceId: string;
    cwd: string;
    threadId: string;
    turnId: string;
    timeoutMs: number;
  }): Promise<ModernApprovalNotification> {
    const payload = await this.processManager.waitForNotification({
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      timeoutMs: Math.max(1_000, input.timeoutMs),
      predicate: (message) => {
        if (message.method !== "item/commandExecution/requestApproval") {
          return false;
        }

        if (!isObjectRecord(message.params)) {
          return false;
        }

        return message.params.threadId === input.threadId && message.params.turnId === input.turnId;
      },
    });

    const params = isObjectRecord(payload.params) ? payload.params : null;
    const command = params && typeof params.command === "string" ? params.command : null;
    const continuationToken =
      params && typeof params.continuationToken === "string"
        ? params.continuationToken
        : undefined;

    return {
      kind: "commandExecution",
      prompt: command
        ? `Codex app-server requests approval to execute: ${command}`
        : "Codex app-server requires approval to continue.",
      continuationToken,
    };
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

function extractModernTurnFromStart(input: unknown): ModernTurn {
  if (!isObjectRecord(input) || !isObjectRecord(input.turn)) {
    throw new AppServerClientError("protocol", "turn/start response missing turn object");
  }

  const id = input.turn.id;
  const status = input.turn.status;
  if (typeof id !== "string" || typeof status !== "string") {
    throw new AppServerClientError("protocol", "turn/start response turn missing id/status");
  }

  return {
    id,
    status,
    error: input.turn.error,
    items: input.turn.items,
  };
}

function extractThreadIdFromThreadStart(input: unknown) {
  if (!isObjectRecord(input) || !isObjectRecord(input.thread)) {
    throw new AppServerClientError("protocol", "thread/start response missing thread object");
  }

  const id = input.thread.id;
  if (typeof id !== "string") {
    throw new AppServerClientError("protocol", "thread/start response thread missing id");
  }

  return id;
}

function findTurnSnapshotById(
  threadReadResult: unknown,
  turnId: string,
): { turn: ModernTurn | null; waitingOnApproval: boolean } {
  if (!isObjectRecord(threadReadResult) || !isObjectRecord(threadReadResult.thread)) {
    return { turn: null, waitingOnApproval: false };
  }

  const waitingOnApproval = hasWaitingOnApprovalFlag(threadReadResult.thread.status);
  const turns = threadReadResult.thread.turns;
  if (!Array.isArray(turns)) {
    return { turn: null, waitingOnApproval };
  }

  for (const item of turns) {
    if (!isObjectRecord(item) || item.id !== turnId) {
      continue;
    }

    const status = item.status;
    if (typeof status !== "string") {
      continue;
    }

    return {
      turn: {
        id: turnId,
        status,
        error: item.error,
        items: item.items,
      },
      waitingOnApproval,
    };
  }

  return { turn: null, waitingOnApproval };
}

function mapModernTurnToAppServerEvent(turn: ModernTurn): AppServerTurnEvent {
  const status = turn.status.toLowerCase();
  if (status === "completed") {
    const event: AppServerTurnCompletedEvent = {
      id: turn.id,
      type: "turn.completed",
      outputText: extractAgentMessageText(turn.items),
    };
    return event;
  }

  if (status.includes("approval")) {
    const event: AppServerTurnApprovalRequiredEvent = {
      id: turn.id,
      type: "turn.approval_required",
      kind: turn.approvalKind ?? "approval_required",
      prompt: turn.approvalPrompt ?? "Codex app-server requires approval to continue.",
      continuationToken: turn.continuationToken,
    };
    return event;
  }

  if (status === "interrupted") {
    throw new AppServerClientError("execution", "turn interrupted");
  }

  if (status === "failed" || status === "errored") {
    throw new AppServerClientError("execution", extractTurnErrorMessage(turn.error));
  }

  const event: AppServerTurnRunningEvent = {
    id: turn.id,
    type: "turn.running",
  };
  return event;
}

function extractAgentMessageText(items: unknown) {
  if (!Array.isArray(items)) {
    return "(empty codex response)";
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!isObjectRecord(item)) {
      continue;
    }

    if (item.type !== "agentMessage") {
      continue;
    }

    if (typeof item.text === "string" && item.text.trim().length > 0) {
      return item.text;
    }
  }

  return "(empty codex response)";
}

function extractTurnErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (isObjectRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return "turn failed";
}

function isRunningStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "inprogress" || normalized === "running";
}

function hasWaitingOnApprovalFlag(status: unknown) {
  if (!isObjectRecord(status)) {
    return false;
  }

  const activeFlags = status.activeFlags;
  if (!Array.isArray(activeFlags)) {
    return false;
  }

  return activeFlags.includes("waitingOnApproval");
}

async function waitForApprovalOrInterval(
  approvalNotificationPromise: Promise<ModernApprovalNotification | null>,
  deadline: number,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return null;
  }

  const interval = Math.min(TURN_POLL_INTERVAL_MS, remaining);
  return Promise.race([
    approvalNotificationPromise,
    sleep(interval).then(() => null),
  ]);
}

function isCapabilityMismatch(error: unknown) {
  if (!isAppServerClientError(error)) {
    return false;
  }

  if (error.code !== "execution" && error.code !== "protocol") {
    return false;
  }

  const lower = error.message.toLowerCase();
  return (
    lower.includes("unsupported method") ||
    lower.includes("unknown variant") ||
    lower.includes("method not found")
  );
}

function isTransientThreadReadState(error: unknown) {
  if (!isAppServerClientError(error)) {
    return false;
  }

  if (error.code !== "execution" && error.code !== "protocol") {
    return false;
  }

  const lower = error.message.toLowerCase();
  return lower.includes("not materialized yet") || lower.includes("includeTurns is unavailable".toLowerCase());
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
