import { RunnerManager } from "@/server/codex/runner-manager";
import type { RunnerGateway, TurnExecutionResult } from "@/server/codex/runner-gateway";

export class MockRunnerGateway implements RunnerGateway {
  backend = "mock" as const;

  private readonly manager = new RunnerManager();

  async ensureRunner(input: { workspaceId: string; cwd: string }) {
    await this.manager.getOrCreate(input.workspaceId, { cwd: input.cwd });
  }

  async startTurn(input: {
    operationId: string;
    workspaceId: string;
    cwd: string;
    sessionId: string;
    threadId: string;
    text: string;
  }): Promise<TurnExecutionResult> {
    return { status: "completed", resultText: `mock: ${input.text}` };
  }

  async resumeAfterApproval(input: {
    operationId: string;
    approvalId: string;
    decision: "approve" | "deny";
    continuationToken?: string;
  }): Promise<TurnExecutionResult> {
    if (input.decision === "deny") {
      return { status: "failed", errorMessage: "approval denied" };
    }

    return { status: "completed", resultText: "mock: resumed after approval" };
  }

  async interruptTurn(input: { operationId: string }) {
    void input;
    return;
  }
}
