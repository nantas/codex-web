import { describe, expect, it } from "vitest";
import { RunnerManager } from "@/server/codex/runner-manager";

describe("RunnerManager", () => {
  it("tracks runtime metadata per workspace", async () => {
    const manager = new RunnerManager();
    const runtime = await manager.getOrCreate("ws-1", { cwd: "/tmp/ws-1" });

    expect(runtime.workspaceId).toBe("ws-1");
    expect(runtime.cwd).toBe("/tmp/ws-1");
    expect(runtime.status).toBe("starting");
  });

  it("reuses one runtime for same workspace", async () => {
    const manager = new RunnerManager();
    const first = await manager.getOrCreate("ws-1", { cwd: "/tmp/ws-1" });
    const second = await manager.getOrCreate("ws-1", { cwd: "/tmp/ignored" });

    expect(second.id).toBe(first.id);
    expect(second.cwd).toBe("/tmp/ws-1");
  });

  it("updates runtime status lifecycle metadata", async () => {
    const manager = new RunnerManager();
    await manager.getOrCreate("ws-2", { cwd: "/tmp/ws-2" });

    manager.markReady("ws-2", { endpoint: "codex://exec", pid: 123 });
    const ready = manager.get("ws-2");
    expect(ready?.status).toBe("ready");
    expect(ready?.endpoint).toBe("codex://exec");
    expect(ready?.pid).toBe(123);
    expect(ready?.lastSeenAt).toBeTruthy();

    manager.markStopped("ws-2");
    expect(manager.get("ws-2")?.status).toBe("stopped");

    manager.markFailed("ws-2");
    expect(manager.get("ws-2")?.status).toBe("failed");
  });
});
