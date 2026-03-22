import { describe, expect, it, vi } from "vitest";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";

describe("codex app-server interrupt", () => {
  it("sends interrupt to app-server active turn handle", async () => {
    const interruptTurn = vi.fn(async () => {});
    const gateway = new CodexAppServerGateway({
      appServerClient: {
        isAvailable: async () => true,
        startTurn: async () => ({ id: "turn-1", type: "turn.running" }),
        resumeAfterApproval: async () => ({ id: "turn-2", type: "turn.running" }),
        interruptTurn,
      },
    });

    await gateway.startTurn({
      operationId: "op-1",
      workspaceId: "ws-1",
      cwd: "/tmp/ws-1",
      sessionId: "ses-1",
      threadId: "thr-1",
      text: "hello",
    });

    await gateway.interruptTurn({ operationId: "op-1" });

    expect(interruptTurn).toHaveBeenCalledWith({
      operationId: "op-1",
      workspaceId: "ws-1",
      turnId: "turn-1",
    });
  });

  it("falls back to process signal when protocol interrupt unavailable", async () => {
    vi.useFakeTimers();
    try {
      const gateway = new CodexAppServerGateway({
        appServerClient: {
          isAvailable: async () => true,
          startTurn: async () => ({ id: "turn-2", type: "turn.running" }),
          resumeAfterApproval: async () => ({ id: "turn-3", type: "turn.running" }),
          interruptTurn: async () => {
            throw new Error("unsupported");
          },
        },
      });

      const kill = vi.fn();
      const anyGateway = gateway as unknown as {
        activeExecutions: Map<string, { child: { kill: (signal: string) => void }; workspaceId: string; interrupted: boolean }>;
        activeAppServerTurns: Map<string, { workspaceId: string; turnId: string }>;
      };

      anyGateway.activeAppServerTurns.set("op-2", { workspaceId: "ws-2", turnId: "turn-2" });
      anyGateway.activeExecutions.set("op-2", {
        child: { kill },
        workspaceId: "ws-2",
        interrupted: false,
      });

      await gateway.interruptTurn({ operationId: "op-2" });
      expect(kill).toHaveBeenCalledWith("SIGINT");

      vi.advanceTimersByTime(1600);
      expect(kill).toHaveBeenCalledWith("SIGKILL");
    } finally {
      vi.useRealTimers();
    }
  });
});
