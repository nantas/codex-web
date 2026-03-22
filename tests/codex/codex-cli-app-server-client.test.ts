import { describe, expect, it, vi } from "vitest";
import { AppServerClientError } from "@/server/codex/app-server/client";
import { CodexCliAppServerClient } from "@/server/codex/app-server/codex-cli-app-server-client";
import { AppServerProcessManager } from "@/server/codex/app-server/process-manager";

describe("CodexCliAppServerClient modern approval detection", () => {
  it("maps command approval notification to turn.approval_required", async () => {
    const manager = new AppServerProcessManager();

    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_1",
      endpoint: "stdio://fake",
      pid: 1001,
    });

    const sendRequest = vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "initialize") {
        return {};
      }
      if (method === "thread/start") {
        return { thread: { id: "thread-modern-1" } };
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-modern-1",
            status: "inProgress",
            items: [],
            error: null,
          },
        };
      }
      if (method === "thread/read") {
        return {
          thread: {
            status: { type: "active", activeFlags: [] },
            turns: [
              {
                id: "turn-modern-1",
                status: "inProgress",
                items: [],
                error: null,
              },
            ],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    vi.spyOn(manager, "waitForNotification").mockResolvedValue({
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "thread-modern-1",
        turnId: "turn-modern-1",
        command: "/bin/zsh -lc 'rm -rf /tmp/codex-approval-test && echo done'",
      },
    });

    const client = new CodexCliAppServerClient(manager);
    const event = await client.startTurn({
      operationId: "op-modern-approval-1",
      workspaceId: "ws-modern-approval-1",
      cwd: process.cwd(),
      sessionId: "ses-modern-approval-1",
      threadId: "thr-modern-approval-1",
      text: "needs approval",
    });

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "thread/read" }),
    );
    expect(event).toMatchObject({
      id: "turn-modern-1",
      type: "turn.approval_required",
      kind: "commandExecution",
    });
    expect(event.type).toBe("turn.approval_required");
    if (event.type === "turn.approval_required") {
      expect(event.prompt).toContain("rm -rf /tmp/codex-approval-test");
    }
  });

  it("accepts approval notification when turnId is omitted but threadId matches", async () => {
    const manager = new AppServerProcessManager();

    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_1b",
      endpoint: "stdio://fake",
      pid: 1011,
    });

    vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "initialize") {
        return {};
      }
      if (method === "thread/start") {
        return { thread: { id: "thread-modern-1b" } };
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-modern-1b",
            status: "inProgress",
            items: [],
            error: null,
          },
        };
      }
      if (method === "thread/read") {
        return {
          thread: {
            status: { type: "active", activeFlags: [] },
            turns: [
              {
                id: "turn-modern-1b",
                status: "inProgress",
                items: [],
                error: null,
              },
            ],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    vi.spyOn(manager, "waitForNotification").mockResolvedValue({
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "thread-modern-1b",
        command: "/bin/zsh -lc 'echo safe-check'",
      },
    });

    const client = new CodexCliAppServerClient(manager);
    const event = await client.startTurn({
      operationId: "op-modern-approval-1b",
      workspaceId: "ws-modern-approval-1b",
      cwd: process.cwd(),
      sessionId: "ses-modern-approval-1b",
      threadId: "thr-modern-approval-1b",
      text: "needs approval without turnId in notification",
    });

    expect(event).toMatchObject({
      id: "turn-modern-1b",
      type: "turn.approval_required",
      kind: "commandExecution",
    });
  });

  it("maps thread waitingOnApproval flag to turn.approval_required even without notification", async () => {
    const manager = new AppServerProcessManager();

    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_2",
      endpoint: "stdio://fake",
      pid: 1002,
    });

    vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "initialize") {
        return {};
      }
      if (method === "thread/start") {
        return { thread: { id: "thread-modern-2" } };
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-modern-2",
            status: "inProgress",
            items: [],
            error: null,
          },
        };
      }
      if (method === "thread/read") {
        return {
          thread: {
            status: { type: "active", activeFlags: ["waitingOnApproval"] },
            turns: [
              {
                id: "turn-modern-2",
                status: "inProgress",
                items: [],
                error: null,
              },
            ],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    vi.spyOn(manager, "waitForNotification").mockImplementation(
      async () =>
        new Promise(() => {
          // keep pending; client should return from thread/read waitingOnApproval without this
        }),
    );

    const client = new CodexCliAppServerClient(manager);
    const event = await client.startTurn({
      operationId: "op-modern-approval-2",
      workspaceId: "ws-modern-approval-2",
      cwd: process.cwd(),
      sessionId: "ses-modern-approval-2",
      threadId: "thr-modern-approval-2",
      text: "waiting by thread status",
    });

    expect(event).toMatchObject({
      id: "turn-modern-2",
      type: "turn.approval_required",
      kind: "commandExecution",
      prompt: "Codex app-server requires approval to continue.",
    });
  });

  it("retries transient thread/read materialization error before mapping approval", async () => {
    const manager = new AppServerProcessManager();
    let readCount = 0;

    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_3",
      endpoint: "stdio://fake",
      pid: 1003,
    });

    vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "initialize") {
        return {};
      }
      if (method === "thread/start") {
        return { thread: { id: "thread-modern-3" } };
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-modern-3",
            status: "inProgress",
            items: [],
            error: null,
          },
        };
      }
      if (method === "thread/read") {
        readCount += 1;
        if (readCount === 1) {
          throw new AppServerClientError(
            "execution",
            "thread x is not materialized yet; includeTurns is unavailable before first user message",
          );
        }
        return {
          thread: {
            status: { type: "active", activeFlags: ["waitingOnApproval"] },
            turns: [
              {
                id: "turn-modern-3",
                status: "inProgress",
                items: [],
                error: null,
              },
            ],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    vi.spyOn(manager, "waitForNotification").mockImplementation(
      async () =>
        new Promise(() => {
          // keep pending; this test validates transient thread/read retry path
        }),
    );

    const client = new CodexCliAppServerClient(manager);
    const event = await client.startTurn({
      operationId: "op-modern-approval-3",
      workspaceId: "ws-modern-approval-3",
      cwd: process.cwd(),
      sessionId: "ses-modern-approval-3",
      threadId: "thr-modern-approval-3",
      text: "transient materialization path",
    });

    expect(readCount).toBeGreaterThanOrEqual(2);
    expect(event).toMatchObject({
      id: "turn-modern-3",
      type: "turn.approval_required",
      kind: "commandExecution",
    });
  });

  it("retries transient empty rollout session-file error before mapping approval", async () => {
    const manager = new AppServerProcessManager();
    let readCount = 0;

    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_3b",
      endpoint: "stdio://fake",
      pid: 1006,
    });

    vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "initialize") {
        return {};
      }
      if (method === "thread/start") {
        return { thread: { id: "thread-modern-3b" } };
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-modern-3b",
            status: "inProgress",
            items: [],
            error: null,
          },
        };
      }
      if (method === "thread/read") {
        readCount += 1;
        if (readCount === 1) {
          throw new AppServerClientError(
            "execution",
            "failed to load rollout `/tmp/rollout.jsonl` for thread t-1: empty session file",
          );
        }
        return {
          thread: {
            status: { type: "active", activeFlags: ["waitingOnApproval"] },
            turns: [
              {
                id: "turn-modern-3b",
                status: "inProgress",
                items: [],
                error: null,
              },
            ],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    vi.spyOn(manager, "waitForNotification").mockImplementation(
      async () =>
        new Promise(() => {
          // keep pending; this test validates transient retry path
        }),
    );

    const client = new CodexCliAppServerClient(manager);
    const event = await client.startTurn({
      operationId: "op-modern-approval-3b",
      workspaceId: "ws-modern-approval-3b",
      cwd: process.cwd(),
      sessionId: "ses-modern-approval-3b",
      threadId: "thr-modern-approval-3b",
      text: "transient rollout empty-session-file path",
    });

    expect(readCount).toBeGreaterThanOrEqual(2);
    expect(event).toMatchObject({
      id: "turn-modern-3b",
      type: "turn.approval_required",
      kind: "commandExecution",
    });
  });

  it("resumes modern approval by replying to server request id", async () => {
    const manager = new AppServerProcessManager();
    let readCount = 0;

    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_4",
      endpoint: "stdio://fake",
      pid: 1004,
    });

    const sendRequest = vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "thread/read") {
        readCount += 1;
        return {
          thread: {
            status: { type: "active", activeFlags: [] },
            turns: [
              {
                id: "turn-modern-4",
                status: readCount === 1 ? "inProgress" : "completed",
                items:
                  readCount === 1
                    ? []
                    : [{ type: "agentMessage", text: "resumed-ok" }],
                error: null,
              },
            ],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    const sendServerResponse = vi.spyOn(manager, "sendServerResponse").mockResolvedValue();
    const client = new CodexCliAppServerClient(manager);
    const event = await client.resumeAfterApproval({
      operationId: "op-modern-approval-4",
      workspaceId: "ws-modern-approval-4",
      cwd: process.cwd(),
      approvalId: "apr-modern-4",
      decision: "approve",
      continuationToken: JSON.stringify({
        protocol: "codex-web-modern-approval",
        requestId: 7,
        threadId: "thread-modern-4",
        turnId: "turn-modern-4",
        approvePayload: "accept",
        denyPayload: "cancel",
      }),
    });

    expect(sendServerResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 7,
        result: "accept",
      }),
    );
    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "thread/read" }),
    );
    expect(event).toMatchObject({
      id: "turn-modern-4",
      type: "turn.completed",
      outputText: "resumed-ok",
    });
  });

  it("uses final thread snapshot after deadline to avoid false timeout", async () => {
    const manager = new AppServerProcessManager();
    let now = 0;
    let readCount = 0;

    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_5",
      endpoint: "stdio://fake",
      pid: 1005,
    });

    vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "initialize") {
        return {};
      }
      if (method === "thread/start") {
        return { thread: { id: "thread-modern-5" } };
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-modern-5",
            status: "inProgress",
            items: [],
            error: null,
          },
        };
      }
      if (method === "thread/read") {
        readCount += 1;
        if (readCount === 1) {
          now = 999_999;
          return {
            thread: {
              status: { type: "active", activeFlags: [] },
              turns: [{ id: "turn-modern-5", status: "inProgress", items: [], error: null }],
            },
          };
        }
        return {
          thread: {
            status: { type: "active", activeFlags: [] },
            turns: [
              {
                id: "turn-modern-5",
                status: "completed",
                items: [{ type: "agentMessage", text: "final-snapshot-ok" }],
                error: null,
              },
            ],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    vi.spyOn(manager, "waitForNotification").mockImplementation(
      async () =>
        new Promise(() => {
          // keep pending; rely on final snapshot path after deadline
        }),
    );

    const client = new CodexCliAppServerClient(manager);
    const event = await client.startTurn({
      operationId: "op-modern-approval-5",
      workspaceId: "ws-modern-approval-5",
      cwd: process.cwd(),
      sessionId: "ses-modern-approval-5",
      threadId: "thr-modern-approval-5",
      text: "final snapshot timeout guard",
    });

    expect(event).toMatchObject({
      id: "turn-modern-5",
      type: "turn.completed",
      outputText: "final-snapshot-ok",
    });
  });

  it("includes thread/turn/request summary in timeout execution error", async () => {
    const manager = new AppServerProcessManager();
    let now = 0;
    let readCount = 0;

    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(manager, "getOrStart").mockResolvedValue({
      id: "pm_6",
      endpoint: "stdio://fake",
      pid: 1006,
    });

    vi.spyOn(manager, "sendRequest").mockImplementation(async ({ method }) => {
      if (method === "initialize") {
        return {};
      }
      if (method === "thread/start") {
        return { thread: { id: "thread-modern-6" } };
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-modern-6",
            status: "inProgress",
            items: [],
            error: null,
          },
        };
      }
      if (method === "thread/read") {
        readCount += 1;
        now = 999_999;
        return {
          thread: {
            status: { type: "active", activeFlags: [] },
            turns: [{ id: "turn-modern-6", status: "inProgress", items: [], error: null }],
          },
        };
      }

      throw new Error(`unexpected method: ${method}`);
    });

    vi.spyOn(manager, "waitForNotification").mockImplementation(
      async () =>
        new Promise(() => {
          // keep pending; rely on timeout path
        }),
    );

    const client = new CodexCliAppServerClient(manager);
    const error = await client
      .startTurn({
        operationId: "op-modern-approval-6",
        workspaceId: "ws-modern-approval-6",
        cwd: process.cwd(),
        sessionId: "ses-modern-approval-6",
        threadId: "thr-modern-approval-6",
        text: "timeout diag",
      })
      .then(() => null)
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(AppServerClientError);
    expect(error).toMatchObject({
      code: "timeout",
      message: expect.stringContaining('"threadId":"thread-modern-6"'),
    });
    expect((error as AppServerClientError).message).toContain('"turnId":"turn-modern-6"');
    expect((error as AppServerClientError).message).toContain('"lastNotificationMethod":null');
    expect((error as AppServerClientError).message).toContain('"lastThreadReadAt":"');
    expect(readCount).toBeGreaterThanOrEqual(2);
  });
});
