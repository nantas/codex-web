import { describe, expect, it, vi } from "vitest";
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
});
