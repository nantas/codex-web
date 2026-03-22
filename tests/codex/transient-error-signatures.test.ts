import { describe, expect, it } from "vitest";
import {
  TRANSIENT_APP_SERVER_ERROR_SIGNATURES,
  matchesTransientSignature,
} from "@/server/codex/app-server/transient-error-signatures";

describe("app-server transient error signatures", () => {
  it("classifies configured signatures as transient via shared registry", () => {
    expect(TRANSIENT_APP_SERVER_ERROR_SIGNATURES.length).toBeGreaterThan(0);

    expect(
      matchesTransientSignature(
        "thread x is not materialized yet; includeTurns is unavailable before first user message",
      ),
    ).toBe(true);

    expect(
      matchesTransientSignature(
        "failed to load rollout `/tmp/rollout.jsonl` for thread t-1: empty session file",
      ),
    ).toBe(true);

    expect(matchesTransientSignature("fatal: authentication failed for codex")).toBe(false);
  });
});
