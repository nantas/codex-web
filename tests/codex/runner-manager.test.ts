import { describe, expect, it } from "vitest";
import { RunnerManager } from "@/server/codex/runner-manager";

describe("RunnerManager", () => {
  it("reuses one runner for same workspace", async () => {
    const manager = new RunnerManager();
    const first = await manager.getOrCreate("ws-1");
    const second = await manager.getOrCreate("ws-1");
    expect(second.id).toBe(first.id);
  });
});
