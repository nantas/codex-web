export type OperationExecutionHandle = {
  operationId: string;
  sessionId: string;
  workspaceId: string;
  cwd: string;
  threadId: string;
  continuationToken?: string;
};

export class OperationExecutionRegistry {
  private readonly byOperation = new Map<string, OperationExecutionHandle>();

  set(entry: OperationExecutionHandle) {
    this.byOperation.set(entry.operationId, entry);
  }

  setContinuationToken(operationId: string, continuationToken: string | undefined) {
    const existing = this.byOperation.get(operationId);
    if (!existing) {
      return;
    }

    existing.continuationToken = continuationToken;
  }

  get(operationId: string) {
    return this.byOperation.get(operationId) ?? null;
  }

  delete(operationId: string) {
    this.byOperation.delete(operationId);
  }
}
