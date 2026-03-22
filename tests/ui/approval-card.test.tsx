// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ApprovalCard from "@/components/sessions/approval-card";

describe("ApprovalCard", () => {
  it("shows approve and deny actions for pending approvals", async () => {
    const onDecision = vi.fn();
    render(
      <ApprovalCard id="apr_1" prompt="Approve command?" status="pending" onDecision={onDecision} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onDecision).toHaveBeenCalledWith("approve");

    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onDecision).toHaveBeenCalledWith("deny");
  });

  it("does not show actions for non-pending approvals", () => {
    render(<ApprovalCard id="apr_2" prompt="Approve command?" status="approved" />);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deny" })).toBeNull();
  });
});
