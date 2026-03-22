import { randomUUID } from "node:crypto";

type AppServerProcessHandle = {
  id: string;
  workspaceId: string;
  cwd: string;
  endpoint: string;
  pid: number | null;
  startedAt: string;
};

export class AppServerProcessManager {
  private readonly byWorkspace = new Map<string, AppServerProcessHandle>();

  async getOrStart(workspaceId: string, input: { cwd: string }): Promise<AppServerProcessHandle> {
    const existing = this.byWorkspace.get(workspaceId);
    if (existing) {
      return existing;
    }

    const handle: AppServerProcessHandle = {
      id: randomUUID(),
      workspaceId,
      cwd: input.cwd,
      endpoint: `codex://app-server/${workspaceId}`,
      pid: null,
      startedAt: new Date().toISOString(),
    };

    this.byWorkspace.set(workspaceId, handle);
    return handle;
  }
}
