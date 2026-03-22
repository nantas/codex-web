import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  NoopAppServerClient,
  type AppServerClient,
  type AppServerTurnInput,
} from "@/server/codex/app-server/client";
import type { AppServerTurnEvent } from "@/server/codex/app-server/protocol";
import { RunnerManager } from "@/server/codex/runner-manager";
import type { RunnerGateway, TurnExecutionResult } from "@/server/codex/runner-gateway";

const DEFAULT_EXEC_TIMEOUT_MS = 5 * 60 * 1000;

type ActiveExecution = {
  child: ChildProcess;
  workspaceId: string;
  interrupted: boolean;
};

type OperationContext = {
  workspaceId: string;
  cwd: string;
  sessionId: string;
  threadId: string;
  text: string;
};

export class CodexAppServerGateway implements RunnerGateway {
  backend = "codex" as const;

  private readonly manager: RunnerManager;
  private readonly appServerClient: AppServerClient;
  private readonly activeExecutions = new Map<string, ActiveExecution>();
  private readonly operationContexts = new Map<string, OperationContext>();

  constructor(input?: { manager?: RunnerManager; appServerClient?: AppServerClient }) {
    this.manager = input?.manager ?? new RunnerManager();
    this.appServerClient = input?.appServerClient ?? new NoopAppServerClient();
  }

  async ensureRunner(input: { workspaceId: string; cwd: string }) {
    const runtime = await this.manager.getOrCreate(input.workspaceId, { cwd: input.cwd });
    if (runtime.status === "ready") {
      this.manager.touch(input.workspaceId);
      return;
    }

    try {
      await this.ensureCodexBinaryReachable(input.cwd);
      const endpoint = (await this.appServerClient.isAvailable())
        ? "codex://app-server"
        : "codex://exec";
      this.manager.markReady(input.workspaceId, { endpoint, pid: null });
    } catch (error) {
      this.manager.markFailed(input.workspaceId);
      throw new Error(`failed to initialize codex backend: ${toErrorMessage(error)}`);
    }
  }

  async startTurn(input: {
    operationId: string;
    workspaceId: string;
    cwd: string;
    sessionId: string;
    threadId: string;
    text: string;
  }): Promise<TurnExecutionResult> {
    this.operationContexts.set(input.operationId, {
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      sessionId: input.sessionId,
      threadId: input.threadId,
      text: input.text,
    });

    const appServerResult = await this.tryStartTurnViaAppServer(input);
    if (appServerResult) {
      this.manager.touch(input.workspaceId);
      return appServerResult;
    }

    return this.runCodexExec({
      operationId: input.operationId,
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      prompt: input.text,
    });
  }

  async resumeAfterApproval(input: {
    operationId: string;
    approvalId: string;
    decision: "approve" | "deny";
    continuationToken?: string;
  }): Promise<TurnExecutionResult> {
    if (input.decision === "deny") {
      return { status: "failed", errorMessage: "approval denied" };
    }

    const context = this.operationContexts.get(input.operationId);
    if (!context) {
      return {
        status: "failed",
        errorMessage: `missing execution context for operation ${input.operationId}`,
      };
    }

    const resumedViaAppServer = await this.tryResumeViaAppServer(input);
    if (resumedViaAppServer) {
      this.manager.touch(context.workspaceId);
      return resumedViaAppServer;
    }

    if (input.continuationToken) {
      return this.runCodexExec({
        operationId: input.operationId,
        workspaceId: context.workspaceId,
        cwd: context.cwd,
        prompt: [
          `Resume operation ${input.operationId} after approval ${input.approvalId}.`,
          `Continuation token: ${input.continuationToken}`,
        ].join("\n"),
      });
    }

    return this.runCodexExec({
      operationId: input.operationId,
      workspaceId: context.workspaceId,
      cwd: context.cwd,
      prompt: [
        `Resume operation ${input.operationId} after approval ${input.approvalId}.`,
        `Original request: ${context.text}`,
      ].join("\n"),
    });
  }

  async interruptTurn(input: { operationId: string }) {
    const active = this.activeExecutions.get(input.operationId);
    if (!active) {
      return;
    }

    active.interrupted = true;
    active.child.kill("SIGINT");
    setTimeout(() => {
      const latest = this.activeExecutions.get(input.operationId);
      if (latest === active) {
        latest.child.kill("SIGKILL");
      }
    }, 1500).unref();
    this.manager.touch(active.workspaceId);
  }

  private async ensureCodexBinaryReachable(cwd: string) {
    const check = await this.runProcess({
      operationId: `codex-probe-${randomUUID()}`,
      workspaceId: "probe",
      cwd,
      command: "codex",
      args: ["--version"],
      timeoutMs: 10_000,
    });

    if (check.code !== 0) {
      throw new Error(check.errorMessage ?? "codex --version failed");
    }
  }

  private async tryResumeViaAppServer(input: {
    operationId: string;
    approvalId: string;
    decision: "approve" | "deny";
    continuationToken?: string;
  }): Promise<TurnExecutionResult | null> {
    if (!input.continuationToken) {
      return null;
    }

    if (!(await this.appServerClient.isAvailable())) {
      return null;
    }

    try {
      const event = await this.appServerClient.resumeAfterApproval({
        operationId: input.operationId,
        approvalId: input.approvalId,
        decision: input.decision,
        continuationToken: input.continuationToken,
      });
      return mapAppServerEventToResult(event);
    } catch {
      return null;
    }
  }

  private async runCodexExec(input: {
    operationId: string;
    workspaceId: string;
    cwd: string;
    prompt: string;
  }): Promise<TurnExecutionResult> {
    const outputFile = join(tmpdir(), `codex-web-${input.operationId}-${randomUUID()}.txt`);
    const timeoutMs = getExecTimeoutMs();
    const result = await this.runProcess({
      operationId: input.operationId,
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      command: "codex",
      args: [
        "exec",
        "--skip-git-repo-check",
        "--color",
        "never",
        "-C",
        input.cwd,
        "--output-last-message",
        outputFile,
        input.prompt,
      ],
      timeoutMs,
    });

    try {
      if (result.interrupted) {
        return { status: "failed", errorMessage: "codex execution interrupted" };
      }

      if (result.timedOut) {
        return { status: "failed", errorMessage: `codex execution timed out after ${timeoutMs}ms` };
      }

      if (result.code !== 0) {
        return {
          status: "failed",
          errorMessage: result.errorMessage ?? `codex exec failed with code ${String(result.code)}`,
        };
      }

      const output = (await readFile(outputFile, "utf8")).trim();
      this.manager.touch(input.workspaceId);
      return { status: "completed", resultText: output.length > 0 ? output : "(empty codex response)" };
    } catch (error) {
      return { status: "failed", errorMessage: toErrorMessage(error) };
    } finally {
      await rm(outputFile, { force: true }).catch(() => undefined);
    }
  }

  private async tryStartTurnViaAppServer(input: AppServerTurnInput): Promise<TurnExecutionResult | null> {
    if (!(await this.appServerClient.isAvailable())) {
      return null;
    }

    try {
      const event = await this.appServerClient.startTurn(input);
      return mapAppServerEventToResult(event);
    } catch {
      return null;
    }
  }

  private async runProcess(input: {
    operationId: string;
    workspaceId: string;
    cwd: string;
    command: string;
    args: string[];
    timeoutMs: number;
  }) {
    return new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      interrupted: boolean;
      timedOut: boolean;
      errorMessage: string | null;
    }>((resolve) => {
      let stderr = "";
      let timedOut = false;

      let child: ChildProcess;
      try {
        child = spawn(input.command, input.args, {
          cwd: input.cwd,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        resolve({
          code: 1,
          signal: null,
          interrupted: false,
          timedOut: false,
          errorMessage: toErrorMessage(error),
        });
        return;
      }

      this.activeExecutions.set(input.operationId, {
        child,
        workspaceId: input.workspaceId,
        interrupted: false,
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        const active = this.activeExecutions.get(input.operationId);
        if (active) {
          active.interrupted = true;
          active.child.kill("SIGKILL");
        } else {
          child.kill("SIGKILL");
        }
      }, input.timeoutMs);

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
        if (stderr.length > 4000) {
          stderr = stderr.slice(-4000);
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        this.activeExecutions.delete(input.operationId);
        this.manager.markFailed(input.workspaceId);
        resolve({
          code: 1,
          signal: null,
          interrupted: false,
          timedOut,
          errorMessage: toErrorMessage(error),
        });
      });

      child.on("close", (code, signal) => {
        clearTimeout(timeout);
        const active = this.activeExecutions.get(input.operationId);
        this.activeExecutions.delete(input.operationId);

        if (code === 0) {
          this.manager.markReady(input.workspaceId, { endpoint: "codex://exec", pid: null });
        } else if (active?.interrupted || timedOut) {
          this.manager.markReady(input.workspaceId, { endpoint: "codex://exec", pid: null });
        } else {
          this.manager.markFailed(input.workspaceId);
        }

        resolve({
          code,
          signal,
          interrupted: Boolean(active?.interrupted),
          timedOut,
          errorMessage: stderr.trim().length > 0 ? sanitizeErrorText(stderr) : null,
        });
      });
    });
  }
}

function mapAppServerEventToResult(event: AppServerTurnEvent): TurnExecutionResult {
  if (event.type === "turn.completed") {
    return {
      status: "completed",
      resultText: event.outputText,
    };
  }

  if (event.type === "turn.approval_required") {
    return {
      status: "waitingApproval",
      kind: event.kind,
      prompt: event.prompt,
      continuationToken: event.continuationToken,
    };
  }

  return { status: "running" };
}

function getExecTimeoutMs() {
  const raw = Number(process.env.CODEX_EXEC_TIMEOUT_MS ?? "");
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_EXEC_TIMEOUT_MS;
  }
  return Math.max(5_000, Math.min(raw, 30 * 60 * 1_000));
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown codex error";
}

function sanitizeErrorText(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 800);
}
