import { describe, expect, it } from "vitest";
import { canAccessApp } from "@/server/auth/session";

describe("canAccessApp", () => {
  it("returns false when session is missing", () => {
    expect(canAccessApp(null)).toBe(false);
  });
});
