// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionDetailConsole from "@/components/sessions/session-detail-console";

describe("SessionDetailConsole", () => {
  it("shows waiting approval badge when status is waitingApproval", () => {
    render(
      <SessionDetailConsole
        initialOperation={{ id: "op-1", status: "waitingApproval", resultText: null }}
      />,
    );
    expect(screen.getByText("Waiting Approval")).toBeInTheDocument();
  });
});
