import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  AppServerClientError,
  type AppServerProcessMeta,
} from "@/server/codex/app-server/client";
import { getCodexCommand } from "@/server/codex/codex-cli";

type AppServerProcessHandle = AppServerProcessMeta & {
  workspaceId: string;
  cwd: string;
  startedAt: string;
  child: ChildProcessWithoutNullStreams;
  pending: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: AppServerClientError) => void;
      timeout: NodeJS.Timeout;
    }
  >;
  stdoutBuffer: string;
  closed: boolean;
};

export class AppServerProcessManager {
  private readonly byWorkspace = new Map<string, AppServerProcessHandle>();

  async getOrStart(workspaceId: string, input: { cwd: string }): Promise<AppServerProcessMeta> {
    const existing = this.byWorkspace.get(workspaceId);
    if (existing && !existing.closed) {
      return pickProcessMeta(existing);
    }

    if (existing?.closed) {
      this.byWorkspace.delete(workspaceId);
    }

    const child = this.spawnProcess(input.cwd);
    const handle: AppServerProcessHandle = {
      id: randomUUID(),
      workspaceId,
      cwd: input.cwd,
      endpoint: `stdio://codex-app-server/${workspaceId}`,
      pid: child.pid ?? null,
      startedAt: new Date().toISOString(),
      child,
      pending: new Map(),
      stdoutBuffer: "",
      closed: false,
    };

    this.attachListeners(handle);
    this.byWorkspace.set(workspaceId, handle);
    return pickProcessMeta(handle);
  }

  async sendRequest(input: {
    workspaceId: string;
    cwd: string;
    method: string;
    params: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<unknown> {
    const timeoutMs = Math.max(1_000, input.timeoutMs ?? 15_000);
    await this.getOrStart(input.workspaceId, { cwd: input.cwd });
    const handle = this.byWorkspace.get(input.workspaceId);

    if (!handle || handle.closed) {
      throw new AppServerClientError("unavailable", "app-server process not available");
    }

    const requestId = randomUUID();
    const payload = JSON.stringify({
      id: requestId,
      method: input.method,
      params: input.params,
    });

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        handle.pending.delete(requestId);
        reject(
          new AppServerClientError(
            "timeout",
            `app-server request timed out: ${input.method} (${timeoutMs}ms)`,
          ),
        );
      }, timeoutMs);

      handle.pending.set(requestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      if (!handle.child.stdin.writable) {
        handle.pending.delete(requestId);
        clearTimeout(timeout);
        reject(new AppServerClientError("unavailable", "app-server stdin not writable"));
        return;
      }

      handle.child.stdin.write(`${payload}\n`, (error) => {
        if (!error) {
          return;
        }

        handle.pending.delete(requestId);
        clearTimeout(timeout);
        reject(new AppServerClientError("unavailable", `app-server write failed: ${error.message}`));
      });
    });
  }

  private spawnProcess(cwd: string) {
    const command = getCodexCommand();

    try {
      return spawn(command, ["app-server"], {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      throw new AppServerClientError("unavailable", `failed to spawn app-server: ${toErrorMessage(error)}`);
    }
  }

  private attachListeners(handle: AppServerProcessHandle) {
    handle.child.stdout.setEncoding("utf8");
    handle.child.stdout.on("data", (chunk: string) => {
      handle.stdoutBuffer += chunk;
      const lines = handle.stdoutBuffer.split("\n");
      handle.stdoutBuffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.length === 0) {
          continue;
        }

        this.handleLine(handle, line);
      }
    });

    handle.child.on("error", (error) => {
      this.closeHandle(handle, new AppServerClientError("unavailable", `app-server error: ${error.message}`));
    });

    handle.child.on("close", (code, signal) => {
      this.closeHandle(
        handle,
        new AppServerClientError(
          "unavailable",
          `app-server exited (code=${String(code)}, signal=${String(signal)})`,
        ),
      );
    });
  }

  private handleLine(handle: AppServerProcessHandle, line: string) {
    let payload: unknown;
    try {
      payload = JSON.parse(line);
    } catch {
      this.rejectAllPending(handle, new AppServerClientError("protocol", "invalid json line from app-server"));
      return;
    }

    if (!isObjectRecord(payload)) {
      this.rejectAllPending(handle, new AppServerClientError("protocol", "invalid app-server payload"));
      return;
    }

    const id = typeof payload.id === "string" ? payload.id : null;
    if (!id) {
      this.rejectAllPending(handle, new AppServerClientError("protocol", "missing app-server response id"));
      return;
    }

    const pending = handle.pending.get(id);
    if (!pending) {
      return;
    }
    handle.pending.delete(id);

    if (isObjectRecord(payload.error)) {
      const code = typeof payload.error.code === "string" ? payload.error.code : "execution";
      const message =
        typeof payload.error.message === "string"
          ? payload.error.message
          : "app-server request failed";
      pending.reject(new AppServerClientError(normalizeErrorCode(code), message));
      return;
    }

    pending.resolve(payload.result);
  }

  private rejectAllPending(handle: AppServerProcessHandle, error: AppServerClientError) {
    for (const [id, pending] of handle.pending.entries()) {
      handle.pending.delete(id);
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
  }

  private closeHandle(handle: AppServerProcessHandle, reason: AppServerClientError) {
    if (handle.closed) {
      return;
    }

    handle.closed = true;
    this.rejectAllPending(handle, reason);
    this.byWorkspace.delete(handle.workspaceId);
  }
}

function pickProcessMeta(handle: AppServerProcessHandle): AppServerProcessMeta {
  return {
    id: handle.id,
    endpoint: handle.endpoint,
    pid: handle.pid,
  };
}

function normalizeErrorCode(code: string) {
  if (code === "timeout") return "timeout" as const;
  if (code === "protocol") return "protocol" as const;
  if (code === "unavailable") return "unavailable" as const;
  return "execution" as const;
}

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown app-server spawn error";
}
