export type OperationExecutionHandle = {
  operationId: string;
  sessionId: string;
  workspaceId: string;
  cwd: string;
  threadId: string;
};

export class OperationExecutionRegistry {
  private readonly byOperation = new Map<string, OperationExecutionHandle>();

  set(entry: OperationExecutionHandle) {
    this.byOperation.set(entry.operationId, entry);
  }

  get(operationId: string) {
    return this.byOperation.get(operationId) ?? null;
  }

  delete(operationId: string) {
    this.byOperation.delete(operationId);
  }
}
