import { describe, expect, it } from "vitest";
import { operationStatusSchema } from "@/server/contracts/api";

describe("operationStatusSchema", () => {
  it("accepts MVP statuses", () => {
    const statuses = ["queued", "running", "waitingApproval", "completed", "failed", "interrupted"];
    for (const value of statuses) {
      expect(operationStatusSchema.parse(value)).toBe(value);
    }
  });
});
