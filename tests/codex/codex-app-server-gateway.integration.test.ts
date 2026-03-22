import { describe, expect, it } from "vitest";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";

describe.skipIf(!process.env.RUN_CODEX_INTEGRATION)("codex app-server integration", () => {
  it("can start runner and execute one simple turn", async () => {
    const gateway = new CodexAppServerGateway();
    await gateway.ensureRunner({ workspaceId: "ws-integration", cwd: process.cwd() });

    const result = await gateway.startTurn({
      operationId: "op-integration",
      sessionId: "ses-integration",
      threadId: "thr-integration",
      text: "echo integration",
    });

    expect(["running", "completed", "waitingApproval"]).toContain(result.status);
  });
});
