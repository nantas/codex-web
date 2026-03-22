import { describe, expect, it } from "vitest";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";

describe("CodexAppServerGateway", () => {
  it("maps app-server completed event to completed result", async () => {
    const gateway = new CodexAppServerGateway({
      appServerClient: {
        isAvailable: async () => true,
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
});
