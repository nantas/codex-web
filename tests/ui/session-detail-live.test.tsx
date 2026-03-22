// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionDetailLive from "@/components/sessions/session-detail-live";

describe("SessionDetailLive", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("submits approval decision", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ approvalId: "apr_1", status: "approved" }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: {
            id: "ses_1",
            status: "running",
            workspaceId: "ws-1",
            cwd: "/tmp/ws-1",
            threadId: "thr_1",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_1",
              status: "running",
              requestText: "cmd",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    render(
      <SessionDetailLive
        sessionId="ses_1"
        initialData={{
          session: {
            id: "ses_1",
            status: "waitingApproval",
            workspaceId: "ws-1",
            cwd: "/tmp/ws-1",
            threadId: "thr_1",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_1",
              status: "waitingApproval",
              requestText: "cmd",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [
                {
                  id: "apr_1",
                  kind: "commandExecution",
                  status: "pending",
                  prompt: "Approve command?",
                  decision: null,
                  updatedAt: "2026-03-21T00:00:00.000Z",
                },
              ],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/approvals/apr_1/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      });
    });
  });

  it("submits a new turn from composer and refreshes operations", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ operationId: "op_new", status: "running", pollAfterMs: 1000 }), {
        status: 202,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: {
            id: "ses_send",
            status: "running",
            workspaceId: "ws-send",
            cwd: "/tmp/ws-send",
            threadId: "thr_send",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_new",
              status: "running",
              requestText: "new turn",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    render(
      <SessionDetailLive
        sessionId="ses_send"
        initialData={{
          session: {
            id: "ses_send",
            status: "running",
            workspaceId: "ws-send",
            cwd: "/tmp/ws-send",
            threadId: "thr_send",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Turn Message"), { target: { value: "new turn" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "ses_send",
          type: "turn.start",
          input: [{ type: "text", text: "new turn" }],
        }),
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/sessions/ses_send", { cache: "no-store" });
    });
  });

  it("renders operation history with request/result/error details", () => {
    render(
      <SessionDetailLive
        sessionId="ses_2"
        initialData={{
          session: {
            id: "ses_2",
            status: "running",
            workspaceId: "ws-2",
            cwd: "/tmp/ws-2",
            threadId: "thr_2",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_completed",
              status: "completed",
              requestText: "echo done",
              resultText: "done",
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [
                {
                  id: 1,
                  level: "info",
                  message: "runner: completed",
                  timestamp: "2026-03-21T00:00:00.000Z",
                },
              ],
            },
            {
              id: "op_failed",
              status: "failed",
              requestText: "bad command",
              resultText: null,
              errorMessage: "command not found",
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [
                {
                  id: 2,
                  level: "error",
                  message: "runner: command not found",
                  timestamp: "2026-03-21T00:00:00.000Z",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Operation History")).toBeInTheDocument();
    expect(screen.getByText("op_completed")).toBeInTheDocument();
    expect(screen.getByText("echo done")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("op_failed")).toBeInTheDocument();
    expect(screen.getByText("bad command")).toBeInTheDocument();
    expect(screen.getByText("error: command not found")).toBeInTheDocument();
    expect(screen.getByText("runner: completed")).toBeInTheDocument();
    expect(screen.getByText("runner: command not found")).toBeInTheDocument();
  });

  it("supports paging through operation history", () => {
    render(
      <SessionDetailLive
        sessionId="ses_3"
        initialData={{
          session: {
            id: "ses_3",
            status: "running",
            workspaceId: "ws-3",
            cwd: "/tmp/ws-3",
            threadId: "thr_3",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            { id: "op_6", status: "running", requestText: "cmd6", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_5", status: "running", requestText: "cmd5", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_4", status: "running", requestText: "cmd4", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_3", status: "running", requestText: "cmd3", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_2", status: "running", requestText: "cmd2", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_1", status: "running", requestText: "cmd1", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
          ],
        }}
      />,
    );

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("op_1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("op_1")).toBeInTheDocument();
  });

  it("applies log filter and reloads visible operation logs", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          operationId: "op_filter",
          logs: [
            {
              id: 10,
              operationId: "op_filter",
              level: "error",
              message: "filtered error line",
              timestamp: "2026-03-21T00:05:00.000Z",
            },
          ],
          nextCursor: 10,
        }),
        { status: 200 },
      ),
    );

    render(
      <SessionDetailLive
        sessionId="ses_filter"
        initialData={{
          session: {
            id: "ses_filter",
            status: "running",
            workspaceId: "ws-filter",
            cwd: "/tmp/ws-filter",
            threadId: "thr-filter",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_filter",
              status: "running",
              requestText: "do work",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [
                {
                  id: 1,
                  level: "info",
                  message: "old info line",
                  timestamp: "2026-03-21T00:00:00.000Z",
                },
              ],
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.change(screen.getByLabelText("Log From"), { target: { value: "2026-03-21T00:04" } });
    fireEvent.change(screen.getByLabelText("Log To"), { target: { value: "2026-03-21T00:06" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain("/api/v1/operations/op_filter/logs");
      expect(url).toContain("after=0");
      expect(url).toContain("level=error");
      expect(url).toContain("from=2026-03-21T00%3A04");
      expect(url).toContain("to=2026-03-21T00%3A06");
      expect(screen.getByText("filtered error line")).toBeInTheDocument();
    });
  });

  it("loads incremental logs with cursor after filter applied", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operationId: "op_inc",
            logs: [
              {
                id: 10,
                operationId: "op_inc",
                level: "error",
                message: "first filtered line",
                timestamp: "2026-03-21T00:05:00.000Z",
              },
            ],
            nextCursor: 10,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operationId: "op_inc",
            logs: [
              {
                id: 11,
                operationId: "op_inc",
                level: "error",
                message: "new incremental line",
                timestamp: "2026-03-21T00:06:00.000Z",
              },
            ],
            nextCursor: 11,
          }),
          { status: 200 },
        ),
      );

    render(
      <SessionDetailLive
        sessionId="ses_inc"
        initialData={{
          session: {
            id: "ses_inc",
            status: "running",
            workspaceId: "ws-inc",
            cwd: "/tmp/ws-inc",
            threadId: "thr-inc",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_inc",
              status: "running",
              requestText: "do incremental",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [],
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(screen.getByText("first filtered line")).toBeInTheDocument();
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain("after=0");
    });

    fireEvent.click(screen.getByRole("button", { name: "Load New Logs" }));

    await waitFor(() => {
      expect(screen.getByText("new incremental line")).toBeInTheDocument();
      const url = String(fetchMock.mock.calls[1][0]);
      expect(url).toContain("after=10");
      expect(url).toContain("level=error");
    });
  });

  it("auto-loads incremental logs by polling when filter is active", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operationId: "op_auto",
            logs: [
              {
                id: 20,
                operationId: "op_auto",
                level: "error",
                message: "first auto line",
                timestamp: "2026-03-21T00:05:00.000Z",
              },
            ],
            nextCursor: 20,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            operationId: "op_auto",
            logs: [
              {
                id: 21,
                operationId: "op_auto",
                level: "error",
                message: "auto appended line",
                timestamp: "2026-03-21T00:06:00.000Z",
              },
            ],
            nextCursor: 21,
          }),
          { status: 200 },
        ),
      );

    render(
      <SessionDetailLive
        sessionId="ses_auto"
        pollIntervalMs={200}
        initialData={{
          session: {
            id: "ses_auto",
            status: "running",
            workspaceId: "ws-auto",
            cwd: "/tmp/ws-auto",
            threadId: "thr-auto",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_auto",
              status: "running",
              requestText: "do auto",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [],
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(screen.getByText("first auto line")).toBeInTheDocument();
      expect(String(fetchMock.mock.calls[0][0])).toContain("after=0");
    });

    await waitFor(() => {
      expect(screen.getByText("auto appended line")).toBeInTheDocument();
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(calledUrls.some((url) => url.includes("after=20"))).toBe(true);
    });
  });

  it("backs off auto polling after failure and retries with longer interval", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operationId: "op_backoff",
            logs: [
              {
                id: 30,
                operationId: "op_backoff",
                level: "error",
                message: "initial line",
                timestamp: "2026-03-21T00:05:00.000Z",
              },
            ],
            nextCursor: 30,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("failed", { status: 500 }))
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            operationId: "op_backoff",
            logs: [
              {
                id: 31,
                operationId: "op_backoff",
                level: "error",
                message: "recovered line",
                timestamp: "2026-03-21T00:06:00.000Z",
              },
            ],
            nextCursor: 31,
          }),
          { status: 200 },
        ),
      );

    render(
      <SessionDetailLive
        sessionId="ses_backoff"
        pollIntervalMs={100}
        initialData={{
          session: {
            id: "ses_backoff",
            status: "running",
            workspaceId: "ws-backoff",
            cwd: "/tmp/ws-backoff",
            threadId: "thr-backoff",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_backoff",
              status: "running",
              requestText: "do backoff",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [],
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(screen.getByText("initial line")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, { timeout: 700 });

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByText("recovered line")).toBeInTheDocument();
    }, { timeout: 900 });
  });

  it("shows timestamped manual log reload failure separately", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operationId: "op_manual_fail",
            logs: [],
            nextCursor: 10,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));

    render(
      <SessionDetailLive
        sessionId="ses_manual_fail"
        pollIntervalMs={10000}
        initialData={{
          session: {
            id: "ses_manual_fail",
            status: "running",
            workspaceId: "ws-manual-fail",
            cwd: "/tmp/ws-manual-fail",
            threadId: "thr-manual-fail",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_manual_fail",
              status: "running",
              requestText: "do manual fail",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [],
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Filter active: yes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Load New Logs" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Manual log reload failed at:/)).toBeInTheDocument();
      expect(screen.getByText(/\d{4}-\d{2}-\d{2}T/)).toBeInTheDocument();
    });
  });

  it("shows timestamped auto log polling failure separately", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operationId: "op_auto_fail",
            logs: [],
            nextCursor: 20,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));

    render(
      <SessionDetailLive
        sessionId="ses_auto_fail"
        pollIntervalMs={120}
        initialData={{
          session: {
            id: "ses_auto_fail",
            status: "running",
            workspaceId: "ws-auto-fail",
            cwd: "/tmp/ws-auto-fail",
            threadId: "thr-auto-fail",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_auto_fail",
              status: "running",
              requestText: "do auto fail",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [],
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Filter active: yes")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Auto log polling failed at:/)).toBeInTheDocument();
      expect(screen.getByText(/\d{4}-\d{2}-\d{2}T/)).toBeInTheDocument();
    }, { timeout: 1200 });
  });

  it("shows log polling observability status and per-operation cursor", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          operationId: "op_obs",
          logs: [
            {
              id: 42,
              operationId: "op_obs",
              level: "error",
              message: "obs line",
              timestamp: "2026-03-21T00:05:00.000Z",
            },
          ],
          nextCursor: 42,
        }),
        { status: 200 },
      ),
    );

    render(
      <SessionDetailLive
        sessionId="ses_obs"
        pollIntervalMs={250}
        initialData={{
          session: {
            id: "ses_obs",
            status: "running",
            workspaceId: "ws-obs",
            cwd: "/tmp/ws-obs",
            threadId: "thr-obs",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            {
              id: "op_obs",
              status: "running",
              requestText: "do obs",
              resultText: null,
              errorMessage: null,
              updatedAt: "2026-03-21T00:00:00.000Z",
              approvals: [],
              logs: [],
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByText("Filter active: yes")).toBeInTheDocument();
      expect(screen.getByText("Auto retry count: 0")).toBeInTheDocument();
      expect(screen.getByText("Next poll delay: 250ms")).toBeInTheDocument();
      expect(screen.getByText("Cursor op_obs: 42")).toBeInTheDocument();
    });
  });

  it("hydrates page and log filter from initial URL state", async () => {
    window.history.replaceState({}, "", "/sessions/ses_hydrate");

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          operationId: "op_1",
          logs: [
            {
              id: 100,
              operationId: "op_1",
              level: "error",
              message: "hydrated log",
              timestamp: "2026-03-21T00:06:00.000Z",
            },
          ],
          nextCursor: 100,
        }),
        { status: 200 },
      ),
    );

    render(
      <SessionDetailLive
        sessionId="ses_hydrate"
        initialUrlState={{
          page: 2,
          level: "error",
          from: "2026-03-21T00:04",
          to: "2026-03-21T00:06",
          filtered: true,
        }}
        initialData={{
          session: {
            id: "ses_hydrate",
            status: "running",
            workspaceId: "ws-hydrate",
            cwd: "/tmp/ws-hydrate",
            threadId: "thr-hydrate",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            { id: "op_6", status: "running", requestText: "cmd6", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_5", status: "running", requestText: "cmd5", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_4", status: "running", requestText: "cmd4", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_3", status: "running", requestText: "cmd3", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_2", status: "running", requestText: "cmd2", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_1", status: "running", requestText: "cmd1", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
          ],
        }}
      />,
    );

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("error")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-21T00:04")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-21T00:06")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByText("Filter active: yes")).toBeInTheDocument();
      expect(screen.getByText("hydrated log")).toBeInTheDocument();
      expect(window.location.search).toContain("page=2");
      expect(window.location.search).toContain("level=error");
      expect(window.location.search).toContain("filtered=1");
    });
  });

  it("syncs URL query when page and log filter controls change", async () => {
    window.history.replaceState({}, "", "/sessions/ses_url_sync");

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          operationId: "op_6",
          logs: [],
          nextCursor: 0,
        }),
        { status: 200 },
      ),
    );

    render(
      <SessionDetailLive
        sessionId="ses_url_sync"
        initialData={{
          session: {
            id: "ses_url_sync",
            status: "running",
            workspaceId: "ws-url-sync",
            cwd: "/tmp/ws-url-sync",
            threadId: "thr-url-sync",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          operations: [
            { id: "op_6", status: "running", requestText: "cmd6", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_5", status: "running", requestText: "cmd5", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_4", status: "running", requestText: "cmd4", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_3", status: "running", requestText: "cmd3", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_2", status: "running", requestText: "cmd2", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
            { id: "op_1", status: "running", requestText: "cmd1", resultText: null, errorMessage: null, updatedAt: "2026-03-21T00:00:00.000Z", approvals: [] },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(window.location.search).toContain("page=2");

    fireEvent.change(screen.getByLabelText("Log Level"), { target: { value: "error" } });
    fireEvent.change(screen.getByLabelText("Log From"), { target: { value: "2026-03-21T00:04" } });
    fireEvent.change(screen.getByLabelText("Log To"), { target: { value: "2026-03-21T00:06" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Log Filter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(window.location.search).toContain("page=2");
      expect(window.location.search).toContain("level=error");
      expect(window.location.search).toContain("from=2026-03-21T00%3A04");
      expect(window.location.search).toContain("to=2026-03-21T00%3A06");
      expect(window.location.search).toContain("filtered=1");
    });
  });
});
