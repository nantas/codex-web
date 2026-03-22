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

  get(workspaceId: string): RunnerRuntime | null {
    return this.byWorkspace.get(workspaceId) ?? null;
  }

  markReady(workspaceId: string, input?: { endpoint?: string | null; pid?: number | null }) {
    const runtime = this.byWorkspace.get(workspaceId);
    if (!runtime) {
      return;
    }

    runtime.status = "ready";
    runtime.endpoint = input?.endpoint ?? runtime.endpoint;
    runtime.pid = input?.pid ?? runtime.pid;
    runtime.lastSeenAt = new Date().toISOString();
  }

  markFailed(workspaceId: string) {
    const runtime = this.byWorkspace.get(workspaceId);
    if (!runtime) {
      return;
    }

    runtime.status = "failed";
    runtime.lastSeenAt = new Date().toISOString();
  }

  markStopped(workspaceId: string) {
    const runtime = this.byWorkspace.get(workspaceId);
    if (!runtime) {
      return;
    }

    runtime.status = "stopped";
    runtime.lastSeenAt = new Date().toISOString();
  }

  touch(workspaceId: string) {
    const runtime = this.byWorkspace.get(workspaceId);
    if (!runtime) {
      return;
    }

    runtime.lastSeenAt = new Date().toISOString();
  }
}
