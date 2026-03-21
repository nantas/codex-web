export type OperationStatus =
  | "queued"
  | "running"
  | "waitingApproval"
  | "completed"
  | "failed"
  | "interrupted";

export type OperationEvent =
  | "start"
  | "requireApproval"
  | "approve"
  | "deny"
  | "complete"
  | "fail"
  | "interrupt";

export function transitionOperationState(
  current: OperationStatus,
  event: OperationEvent,
): OperationStatus {
  if (current === "queued" && event === "start") return "running";
  if (current === "running" && event === "requireApproval") return "waitingApproval";
  if (current === "waitingApproval" && event === "approve") return "running";
  if (current === "waitingApproval" && event === "deny") return "failed";
  if (current === "running" && event === "complete") return "completed";
  if (current === "running" && event === "fail") return "failed";
  if (
    (current === "queued" || current === "running" || current === "waitingApproval") &&
    event === "interrupt"
  ) {
    return "interrupted";
  }
  throw new Error(`Invalid transition: ${current} -> ${event}`);
}
