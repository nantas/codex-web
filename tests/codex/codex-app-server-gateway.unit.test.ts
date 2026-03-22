import { describe, expect, it } from "vitest";
import { AppServerClientError } from "@/server/codex/app-server/client";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";
import { RunnerManager } from "@/server/codex/runner-manager";

describe("CodexAppServerGateway", () => {
  it("maps app-server completed event to completed result", async () => {
    const gateway = new CodexAppServerGateway({
      appServerClient: {
        isAvailable: async () => true,
        ensureProcess: async () => ({ id: "proc-1", endpoint: "stdio://test", pid: 123 }),
        startTurn: async () => ({ id: "evt-1", type: "turn.completed", outputText: "hello" }),
        resumeAfterApproval: async () => ({ id: "evt-2", type: "turn.completed", outputText: "hello" }),
        interruptTurn: async () => {},
      },
    });

    const result = await gateway.startTurn({
      operationId: "op-1",
      workspaceId: "ws-1",
      cwd: process.cwd(),
      sessionId: "ses-1",
      threadId: "thr-1",
      text: "hello",
    });

    expect(result.status).toBe("completed");
    expect(result).toMatchObject({ resultText: "hello" });
  });

  it("returns classified app-server error instead of silently falling back", async () => {
    const gateway = new CodexAppServerGateway({
      appServerClient: {
        isAvailable: async () => true,
        ensureProcess: async () => ({ id: "proc-1", endpoint: "stdio://test", pid: 123 }),
        startTurn: async () => {
          throw new AppServerClientError("execution", "permission denied by policy");
        },
        resumeAfterApproval: async () => ({ id: "evt-2", type: "turn.completed", outputText: "hello" }),
        interruptTurn: async () => {},
      },
    });

    const result = await gateway.startTurn({
      operationId: "op-1",
      workspaceId: "ws-1",
      cwd: process.cwd(),
      sessionId: "ses-1",
      threadId: "thr-1",
      text: "hello",
    });

    expect(result).toMatchObject({
      status: "failed",
      errorMessage: "[APP_SERVER_EXECUTION] permission denied by policy",
    });
  });

  it("binds workspace process metadata when app-server process is available", async () => {
    const manager = new RunnerManager();
    const gateway = new CodexAppServerGateway({
      manager,
      appServerClient: {
        isAvailable: async () => true,
        ensureProcess: async () => ({ id: "proc-9", endpoint: "stdio://app", pid: 999 }),
        startTurn: async () => ({ id: "evt-1", type: "turn.completed", outputText: "hello" }),
        resumeAfterApproval: async () => ({ id: "evt-2", type: "turn.completed", outputText: "hello" }),
        interruptTurn: async () => {},
      },
    });

    await gateway.ensureRunner({ workspaceId: "ws-9", cwd: "/tmp/ws-9" });
    const runtime = manager.get("ws-9");

    expect(runtime?.status).toBe("ready");
    expect(runtime?.endpoint).toBe("stdio://app");
    expect(runtime?.pid).toBe(999);
    expect(runtime?.processHandleId).toBe("proc-9");
  });

  it("sends deny decision to app-server when continuation token exists", async () => {
    let decisionSeen: string | null = null;
    const gateway = new CodexAppServerGateway({
      appServerClient: {
        isAvailable: async () => true,
        ensureProcess: async () => ({ id: "proc-10", endpoint: "stdio://test", pid: 1000 }),
        startTurn: async () => ({
          id: "evt-10",
          type: "turn.approval_required",
          kind: "commandExecution",
          prompt: "needs approval",
          continuationToken: "token-10",
        }),
        resumeAfterApproval: async (input) => {
          decisionSeen = input.decision;
          return {
            id: "evt-11",
            type: "turn.running",
          };
        },
        interruptTurn: async () => {},
      },
    });

    await gateway.startTurn({
      operationId: "op-10",
      workspaceId: "ws-10",
      cwd: process.cwd(),
      sessionId: "ses-10",
      threadId: "thr-10",
      text: "dangerous",
    });
    const result = await gateway.resumeAfterApproval({
      operationId: "op-10",
      approvalId: "apr-10",
      decision: "deny",
      continuationToken: "token-10",
    });

    expect(decisionSeen).toBe("deny");
    expect(result).toMatchObject({
      status: "running",
    });
  });
});
