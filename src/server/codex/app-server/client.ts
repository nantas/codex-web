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
  approvalId: string;
  decision: "approve" | "deny";
  continuationToken: string;
};

export type AppServerInterruptInput = {
  operationId: string;
  workspaceId: string;
  turnId: string;
};

export type AppServerClient = {
  isAvailable(): Promise<boolean>;
  startTurn(input: AppServerTurnInput): Promise<AppServerTurnEvent>;
  resumeAfterApproval(input: AppServerResumeInput): Promise<AppServerTurnEvent>;
  interruptTurn(input: AppServerInterruptInput): Promise<void>;
};

export class NoopAppServerClient implements AppServerClient {
  async isAvailable() {
    return false;
  }

  async startTurn(input: AppServerTurnInput): Promise<AppServerTurnEvent> {
    void input;
    throw new Error("app-server unavailable");
  }

  async resumeAfterApproval(input: AppServerResumeInput): Promise<AppServerTurnEvent> {
    void input;
    throw new Error("app-server unavailable");
  }

  async interruptTurn(input: AppServerInterruptInput): Promise<void> {
    void input;
    throw new Error("app-server unavailable");
  }
}
