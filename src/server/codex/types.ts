export type RunnerHandle = {
  id: string;
  workspaceId: string;
  status: "ready" | "failed";
};
