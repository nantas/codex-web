import { describe, expect, it } from "vitest";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";

describe.skipIf(!process.env.RUN_CODEX_INTEGRATION)("codex app-server integration", () => {
  it(
    "can start runner and execute one simple turn",
    { timeout: 60_000 },
    async () => {
    const gateway = new CodexAppServerGateway();
    await gateway.ensureRunner({ workspaceId: "ws-integration", cwd: process.cwd() });

      const result = await gateway.startTurn({
        operationId: "op-integration",
        workspaceId: "ws-integration",
      cwd: process.cwd(),
      sessionId: "ses-integration",
      threadId: "thr-integration",
      text: "Reply with exactly: integration-ok",
      });

      expect(["completed", "failed", "running", "waitingApproval"]).toContain(result.status);
      if (result.status === "completed") {
        expect(typeof result.resultText).toBe("string");
      }
    },
  );
});
