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

  it("waits for modern slash-protocol notifications", async () => {
    process.env.CODEX_BIN = join(process.cwd(), "tests/fixtures/fake-codex-cli.mjs");

    const manager = new AppServerProcessManager();
    await manager.sendRequest({
      workspaceId: "ws-3",
      cwd: process.cwd(),
      method: "initialize",
      params: {
        clientInfo: {
          name: "codex-web",
          version: "0.1.0",
        },
      },
    });

    const threadStart = await manager.sendRequest({
      workspaceId: "ws-3",
      cwd: process.cwd(),
      method: "thread/start",
      params: {
        cwd: process.cwd(),
      },
    });

    const threadId = (threadStart as { thread?: { id?: string } }).thread?.id;
    expect(typeof threadId).toBe("string");

    await manager.sendRequest({
      workspaceId: "ws-3",
      cwd: process.cwd(),
      method: "turn/start",
      params: {
        threadId,
        input: [{ type: "text", text: "hello-notification" }],
      },
    });

    const notification = await manager.waitForNotification({
      workspaceId: "ws-3",
      cwd: process.cwd(),
      timeoutMs: 5_000,
      predicate: (payload) => payload.method === "turn/completed",
    });

    expect(notification).toMatchObject({
      method: "turn/completed",
      params: {
        threadId,
      },
    });
  });
});
