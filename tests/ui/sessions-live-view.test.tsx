// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionsLiveView from "@/components/sessions/sessions-live-view";

describe("SessionsLiveView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes session list by polling", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sessions: [
              {
                id: "ses_2",
                status: "running",
                workspaceId: "ws-2",
                cwd: "/tmp/ws-2",
                pendingApprovals: 1,
                latestOperation: { id: "op_2", status: "waitingApproval" },
                updatedAt: "2026-03-21T00:00:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    render(
      <SessionsLiveView
        pollIntervalMs={20}
        initialSessions={[
          {
            id: "ses_1",
            status: "idle",
            workspaceId: "ws-1",
            cwd: "/tmp/ws-1",
            pendingApprovals: 0,
            latestOperation: null,
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("ses_1")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/sessions", { cache: "no-store" });
      expect(screen.getByText("ses_2")).toBeInTheDocument();
    });
  });
});
