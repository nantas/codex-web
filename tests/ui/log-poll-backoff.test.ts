import { describe, expect, it } from "vitest";
import { computeLogPollDelayMs } from "@/components/sessions/log-poll-backoff";

describe("log-poll-backoff", () => {
  it("keeps base interval when no filter is active", () => {
    expect(
      computeLogPollDelayMs({
        pollIntervalMs: 3000,
        filtered: false,
        failures: 5,
      }),
    ).toBe(3000);
  });

  it("keeps exact exponential delay when failures is zero", () => {
    expect(
      computeLogPollDelayMs({
        pollIntervalMs: 250,
        filtered: true,
        failures: 0,
        random: () => 0.99,
      }),
    ).toBe(250);
  });

  it("adds jitter for backoff retries after failures", () => {
    expect(
      computeLogPollDelayMs({
        pollIntervalMs: 100,
        filtered: true,
        failures: 1,
        random: () => 0,
      }),
    ).toBe(200);

    expect(
      computeLogPollDelayMs({
        pollIntervalMs: 100,
        filtered: true,
        failures: 1,
        random: () => 1,
      }),
    ).toBe(250);
  });

  it("never exceeds max delay cap", () => {
    expect(
      computeLogPollDelayMs({
        pollIntervalMs: 3000,
        filtered: true,
        failures: 8,
        random: () => 1,
      }),
    ).toBe(30000);
  });
});
