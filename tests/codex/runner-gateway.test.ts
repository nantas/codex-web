import { afterEach, describe, expect, it } from "vitest";
import { createRunnerGateway } from "@/server/codex/runner-gateway";

const originalBackend = process.env.EXECUTION_BACKEND;

afterEach(() => {
  if (originalBackend === undefined) {
    delete process.env.EXECUTION_BACKEND;
    return;
  }

  process.env.EXECUTION_BACKEND = originalBackend;
});

describe("runner gateway factory", () => {
  it("returns mock gateway by default", () => {
    delete process.env.EXECUTION_BACKEND;
    const gateway = createRunnerGateway();
    expect(gateway.backend).toBe("mock");
  });

  it("returns codex gateway when backend is codex", () => {
    process.env.EXECUTION_BACKEND = "codex";
    const gateway = createRunnerGateway();
    expect(gateway.backend).toBe("codex");
  });
});
