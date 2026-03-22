import type { AppServerTurnEvent } from "@/server/codex/app-server/protocol";

export function parseAppServerLine(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

export type AppServerTurnInput = {
  operationId: string;
  workspaceId: string;
  cwd: string;
  sessionId: string;
  threadId: string;
  text: string;
};

export type AppServerResumeInput = {
  operationId: string;
  workspaceId: string;
  cwd: string;
  approvalId: string;
  decision: "approve" | "deny";
  continuationToken: string;
};

export type AppServerInterruptInput = {
  operationId: string;
  workspaceId: string;
  cwd: string;
  turnId: string;
};

export type AppServerProcessMeta = {
  id: string;
  endpoint: string;
  pid: number | null;
};

export type AppServerClientErrorCode = "unavailable" | "protocol" | "execution" | "timeout";

export class AppServerClientError extends Error {
  constructor(
    public readonly code: AppServerClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppServerClientError";
  }
}

export function isAppServerClientError(error: unknown): error is AppServerClientError {
  return error instanceof AppServerClientError;
}

export type AppServerClient = {
  isAvailable(): Promise<boolean>;
  ensureProcess(input: { workspaceId: string; cwd: string }): Promise<AppServerProcessMeta | null>;
  startTurn(input: AppServerTurnInput): Promise<AppServerTurnEvent>;
  resumeAfterApproval(input: AppServerResumeInput): Promise<AppServerTurnEvent>;
  interruptTurn(input: AppServerInterruptInput): Promise<void>;
};

export class NoopAppServerClient implements AppServerClient {
  async isAvailable() {
    return false;
  }

  async ensureProcess(input: { workspaceId: string; cwd: string }): Promise<AppServerProcessMeta | null> {
    void input;
    return null;
  }

  async startTurn(input: AppServerTurnInput): Promise<AppServerTurnEvent> {
    void input;
    throw new AppServerClientError("unavailable", "app-server unavailable");
  }

  async resumeAfterApproval(input: AppServerResumeInput): Promise<AppServerTurnEvent> {
    void input;
    throw new AppServerClientError("unavailable", "app-server unavailable");
  }

  async interruptTurn(input: AppServerInterruptInput): Promise<void> {
    void input;
    throw new AppServerClientError("unavailable", "app-server unavailable");
  }
}
