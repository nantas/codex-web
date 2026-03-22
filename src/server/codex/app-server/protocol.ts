export type AppServerTurnCompletedEvent = {
  id: string;
  type: "turn.completed";
  outputText: string;
};
