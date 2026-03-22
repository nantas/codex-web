import { randomUUID } from "node:crypto";
import type { RunnerRuntime } from "./types";

export class RunnerManager {
  private readonly byWorkspace = new Map<string, RunnerRuntime>();

  async getOrCreate(workspaceId: string, input: { cwd: string }): Promise<RunnerRuntime> {
    const existing = this.byWorkspace.get(workspaceId);
    if (existing) return existing;

    const created: RunnerRuntime = {
      id: randomUUID(),
      workspaceId,
      cwd: input.cwd,
      endpoint: null,
      pid: null,
      status: "starting",
      lastSeenAt: null,
    };
    this.byWorkspace.set(workspaceId, created);
    return created;
  }
}
