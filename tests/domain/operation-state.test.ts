import { describe, expect, it } from "vitest";
import { transitionOperationState } from "@/server/domain/operation-state";

describe("transitionOperationState", () => {
  it("allows running -> waitingApproval -> running -> completed", () => {
    let state = transitionOperationState("queued", "start");
    state = transitionOperationState(state, "requireApproval");
    state = transitionOperationState(state, "approve");
    state = transitionOperationState(state, "complete");
    expect(state).toBe("completed");
  });
});
