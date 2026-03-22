import { describe, expect, it } from "vitest";
import { getExecutionBackend } from "@/server/runtime/execution-config";

describe("execution backend config", () => {
  it("defaults to mock", () => {
    const previous = process.env.EXECUTION_BACKEND;
    delete process.env.EXECUTION_BACKEND;

    try {
      expect(getExecutionBackend()).toBe("mock");
    } finally {
      if (previous === undefined) {
        delete process.env.EXECUTION_BACKEND;
      } else {
        process.env.EXECUTION_BACKEND = previous;
      }
    }
  });

  it("accepts codex backend", () => {
    const previous = process.env.EXECUTION_BACKEND;
    process.env.EXECUTION_BACKEND = "codex";

    try {
      expect(getExecutionBackend()).toBe("codex");
    } finally {
      if (previous === undefined) {
        delete process.env.EXECUTION_BACKEND;
      } else {
        process.env.EXECUTION_BACKEND = previous;
      }
    }
  });
});
