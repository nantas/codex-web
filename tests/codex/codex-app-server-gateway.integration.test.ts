import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";

describe("codex app-server integration", () => {
  it("prefers app-server transport with deterministic fake codex cli", { timeout: 60_000 }, async () => {
    const fakeLogFile = join(tmpdir(), `fake-codex-log-${Date.now()}.txt`);
    const previousCodexBin = process.env.CODEX_BIN;
    const previousAppServerEnabled = process.env.CODEX_APP_SERVER_ENABLED;
    const previousFakeLog = process.env.CODEX_FAKE_LOG;

    process.env.CODEX_BIN = join(process.cwd(), "tests/fixtures/fake-codex-cli.mjs");
    process.env.CODEX_APP_SERVER_ENABLED = "1";
    process.env.CODEX_FAKE_LOG = fakeLogFile;

    try {
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

      expect(result).toMatchObject({
        status: "completed",
        resultText: "app:Reply with exactly: integration-ok",
      });
    } finally {
      if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
      else process.env.CODEX_BIN = previousCodexBin;

      if (previousAppServerEnabled === undefined) delete process.env.CODEX_APP_SERVER_ENABLED;
      else process.env.CODEX_APP_SERVER_ENABLED = previousAppServerEnabled;

      if (previousFakeLog === undefined) delete process.env.CODEX_FAKE_LOG;
      else process.env.CODEX_FAKE_LOG = previousFakeLog;

      await rm(fakeLogFile, { force: true }).catch(() => undefined);
    }
  });
});
