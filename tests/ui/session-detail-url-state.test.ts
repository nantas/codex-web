import { describe, expect, it } from "vitest";
import {
  buildSessionDetailUrlQuery,
  parseSessionDetailUrlState,
} from "@/components/sessions/session-detail-url-state";

describe("session-detail-url-state", () => {
  it("parses valid URL state with defaults", () => {
    const parsed = parseSessionDetailUrlState({
      page: "2",
      level: "error",
      from: "2026-03-21T10:00",
      to: "2026-03-21T11:00",
      filtered: "1",
    });

    expect(parsed).toEqual({
      page: 2,
      level: "error",
      from: "2026-03-21T10:00",
      to: "2026-03-21T11:00",
      filtered: true,
    });
  });

  it("falls back to safe defaults for invalid values", () => {
    const parsed = parseSessionDetailUrlState({
      page: "-3",
      level: "warn",
      from: ["2026-03-21T10:00", "ignored"],
      to: undefined,
      filtered: "0",
    });

    expect(parsed).toEqual({
      page: 1,
      level: "all",
      from: "2026-03-21T10:00",
      to: "",
      filtered: false,
    });
  });

  it("builds compact query for non-default state", () => {
    const query = buildSessionDetailUrlQuery({
      page: 3,
      level: "info",
      from: "2026-03-21T10:00",
      to: "2026-03-21T11:00",
      filtered: true,
    });

    expect(query).toBe(
      "page=3&level=info&from=2026-03-21T10%3A00&to=2026-03-21T11%3A00&filtered=1",
    );
  });

  it("omits defaults in query string", () => {
    const query = buildSessionDetailUrlQuery({
      page: 1,
      level: "all",
      from: "",
      to: "",
      filtered: false,
    });

    expect(query).toBe("");
  });
});
