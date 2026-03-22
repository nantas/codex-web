import { RunnerManager } from "@/server/codex/runner-manager";
import type { RunnerGateway, TurnExecutionResult } from "@/server/codex/runner-gateway";

export class CodexAppServerGateway implements RunnerGateway {
  backend = "codex" as const;

  private readonly manager = new RunnerManager();

  async ensureRunner(input: { workspaceId: string; cwd: string }) {
    await this.manager.getOrCreate(input.workspaceId, { cwd: input.cwd });
  }

  async startTurn(input: {
    operationId: string;
    sessionId: string;
    threadId: string;
    text: string;
  }): Promise<TurnExecutionResult> {
    void input;
    // Phase 1 protocol spike placeholder: real app-server invocation is guarded by integration test.
    return { status: "running" };
  }

  async resumeAfterApproval(input: {
    operationId: string;
    approvalId: string;
    decision: "approve" | "deny";
  }): Promise<TurnExecutionResult> {
    if (input.decision === "deny") {
      return { status: "failed", errorMessage: "approval denied" };
    }

    return { status: "running" };
  }

  async interruptTurn(input: { operationId: string }) {
    void input;
    return;
  }
}
