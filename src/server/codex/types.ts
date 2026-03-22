export type RunnerRuntime = {
  id: string;
  workspaceId: string;
  cwd: string;
  endpoint: string | null;
  pid: number | null;
  processHandleId: string | null;
  status: "starting" | "ready" | "failed" | "stopped";
  lastSeenAt: string | null;
};
