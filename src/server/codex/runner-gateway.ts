import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";
import { MockRunnerGateway } from "@/server/codex/backends/mock-runner-gateway";
import { getExecutionBackend, type ExecutionBackend } from "@/server/runtime/execution-config";

export type TurnExecutionResult =
  | { status: "completed"; resultText: string }
  | { status: "failed"; errorMessage: string }
  | { status: "waitingApproval"; kind: string; prompt: string }
  | { status: "running" };

export type RunnerGateway = {
  backend: ExecutionBackend;
  ensureRunner(input: { workspaceId: string; cwd: string }): Promise<void>;
  startTurn(input: {
    operationId: string;
    workspaceId: string;
    cwd: string;
    sessionId: string;
    threadId: string;
    text: string;
  }): Promise<TurnExecutionResult>;
  resumeAfterApproval(input: {
    operationId: string;
    approvalId: string;
    decision: "approve" | "deny";
  }): Promise<TurnExecutionResult>;
  interruptTurn(input: { operationId: string }): Promise<void>;
};

let gatewaySingleton: RunnerGateway | null = null;

export function createRunnerGateway(backend = getExecutionBackend()): RunnerGateway {
  if (backend === "codex") {
    return new CodexAppServerGateway();
  }

  return new MockRunnerGateway();
}

export function getRunnerGateway(): RunnerGateway {
  if (!gatewaySingleton) {
    gatewaySingleton = createRunnerGateway();
  }

  return gatewaySingleton;
}

export function setRunnerGatewayForTest(gateway: RunnerGateway | null) {
  gatewaySingleton = gateway;
}
