export type AppServerTurnCompletedEvent = {
  id: string;
  type: "turn.completed";
  outputText: string;
};

export type AppServerTurnApprovalRequiredEvent = {
  id: string;
  type: "turn.approval_required";
  kind: string;
  prompt: string;
};

export type AppServerTurnRunningEvent = {
  id: string;
  type: "turn.running";
};

export type AppServerTurnEvent =
  | AppServerTurnCompletedEvent
  | AppServerTurnApprovalRequiredEvent
  | AppServerTurnRunningEvent;
