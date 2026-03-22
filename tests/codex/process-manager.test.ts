import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppServerProcessManager } from "@/server/codex/app-server/process-manager";

const originalCodexBin = process.env.CODEX_BIN;

afterEach(() => {
  if (originalCodexBin === undefined) {
    delete process.env.CODEX_BIN;
  } else {
    process.env.CODEX_BIN = originalCodexBin;
  }
});

describe("AppServerProcessManager", () => {
  it("reuses one process per workspace", async () => {
    process.env.CODEX_BIN = join(process.cwd(), "tests/fixtures/fake-codex-cli.mjs");

    const manager = new AppServerProcessManager();
    const first = await manager.getOrStart("ws-1", { cwd: process.cwd() });
    const second = await manager.getOrStart("ws-1", { cwd: process.cwd() });

    expect(second.id).toBe(first.id);
  });

  it("sends request over persistent app-server process", async () => {
    process.env.CODEX_BIN = join(process.cwd(), "tests/fixtures/fake-codex-cli.mjs");

    const manager = new AppServerProcessManager();
    const response = await manager.sendRequest({
      workspaceId: "ws-2",
      cwd: process.cwd(),
      method: "turn.start",
      params: { text: "from-manager-test" },
    });

    expect(response).toMatchObject({
      type: "turn.completed",
      outputText: "app:from-manager-test",
    });
  });
});
