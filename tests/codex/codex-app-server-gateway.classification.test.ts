import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodexAppServerGateway } from "@/server/codex/backends/codex-app-server-gateway";

const originalCodexBin = process.env.CODEX_BIN;
const originalAppServerEnabled = process.env.CODEX_APP_SERVER_ENABLED;

afterEach(() => {
  if (originalCodexBin === undefined) delete process.env.CODEX_BIN;
  else process.env.CODEX_BIN = originalCodexBin;

  if (originalAppServerEnabled === undefined) delete process.env.CODEX_APP_SERVER_ENABLED;
  else process.env.CODEX_APP_SERVER_ENABLED = originalAppServerEnabled;
});

describe("codex exec error classification", () => {
  it("classifies auth failure from codex stderr", async () => {
    process.env.CODEX_BIN = join(process.cwd(), "tests/fixtures/fake-codex-cli.mjs");
    process.env.CODEX_APP_SERVER_ENABLED = "0";

    const gateway = new CodexAppServerGateway();
    const result = await gateway.startTurn({
      operationId: "op-auth-fail",
      workspaceId: "ws-auth-fail",
      cwd: process.cwd(),
      sessionId: "ses-auth-fail",
      threadId: "thr-auth-fail",
      text: "AUTH_FAIL",
    });

    expect(result).toMatchObject({
      status: "failed",
      errorMessage: "[CODEX_AUTH] Authentication failed. Please run codex login.",
    });
  });
});
