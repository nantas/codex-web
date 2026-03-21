import { randomUUID } from "node:crypto";
import type { RunnerHandle } from "./types";

export class RunnerManager {
  private readonly byWorkspace = new Map<string, RunnerHandle>();

  async getOrCreate(workspaceId: string): Promise<RunnerHandle> {
    const existing = this.byWorkspace.get(workspaceId);
    if (existing) return existing;

    const created: RunnerHandle = {
      id: randomUUID(),
      workspaceId,
      status: "ready",
    };
    this.byWorkspace.set(workspaceId, created);
    return created;
  }
}
