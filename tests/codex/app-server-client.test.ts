import { describe, expect, it } from "vitest";
import { parseAppServerLine } from "@/server/codex/app-server/client";

describe("app-server client protocol", () => {
  it("parses json line payload", () => {
    const parsed = parseAppServerLine('{"id":"1","type":"turn.completed"}');
    expect(parsed).toMatchObject({ id: "1", type: "turn.completed" });
  });
});
