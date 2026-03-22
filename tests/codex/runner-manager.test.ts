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
});
