export type ExecutionBackend = "mock" | "codex";

export function getExecutionBackend(): ExecutionBackend {
  return process.env.EXECUTION_BACKEND === "codex" ? "codex" : "mock";
}
