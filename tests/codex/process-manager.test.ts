import { describe, expect, it } from "vitest";
import { AppServerProcessManager } from "@/server/codex/app-server/process-manager";

describe("AppServerProcessManager", () => {
  it("reuses one process per workspace", async () => {
    const manager = new AppServerProcessManager();
    const first = await manager.getOrStart("ws-1", { cwd: "/tmp/ws-1" });
    const second = await manager.getOrStart("ws-1", { cwd: "/tmp/ws-1" });

    expect(second.id).toBe(first.id);
  });
});
