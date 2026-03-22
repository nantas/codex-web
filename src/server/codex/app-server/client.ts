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

export type AppServerClient = {
  isAvailable(): Promise<boolean>;
  startTurn(input: AppServerTurnInput): Promise<AppServerTurnEvent>;
};

export class NoopAppServerClient implements AppServerClient {
  async isAvailable() {
    return false;
  }

  async startTurn(_input: AppServerTurnInput): Promise<AppServerTurnEvent> {
    throw new Error("app-server unavailable");
  }
}
