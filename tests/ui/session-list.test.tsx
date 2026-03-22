// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SessionList from "@/components/sessions/session-list";

describe("SessionList", () => {
  it("shows session metadata and detail entry", () => {
    render(
      <SessionList
        sessions={[
          {
            id: "ses_1",
            status: "running",
            workspaceId: "workspace-a",
            cwd: "/tmp/workspace-a",
            pendingApprovals: 2,
            latestOperation: { id: "op_1", status: "waitingApproval" },
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("ses_1")).toBeInTheDocument();
    expect(screen.getByText("workspace-a")).toBeInTheDocument();
    expect(screen.getByText("2 pending approvals")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "/sessions/ses_1",
    );
  });
});
