#!/usr/bin/env node
import fs from "node:fs";

const args = process.argv.slice(2);
const threads = new Map();
let threadSeq = 0;
let turnSeq = 0;

function writeLog(message) {
  const logPath = process.env.CODEX_FAKE_LOG;
  if (!logPath) {
    return;
  }

  fs.appendFileSync(logPath, `${message}\n`, "utf8");
}

function runVersion() {
  process.stdout.write("codex-fake 0.0.1\n");
  process.exit(0);
}

function runExec() {
  writeLog(`exec:${args.join(" ")}`);

  const outputFileIndex = args.indexOf("--output-last-message");
  const outputFile = outputFileIndex >= 0 ? args[outputFileIndex + 1] : null;
  const prompt = args.at(-1) ?? "";

  if (prompt.includes("AUTH_FAIL")) {
    process.stderr.write("Authentication failed. Please run codex login.\n");
    process.exit(1);
    return;
  }

  if (outputFile) {
    const content = prompt.includes("integration-ok") ? "integration-ok" : `exec:${prompt}`;
    fs.writeFileSync(outputFile, `${content}\n`, "utf8");
  }

  process.exit(0);
}

function runAppServer() {
  writeLog("app-server:started");
  process.stdin.setEncoding("utf8");

  let buffer = "";
  process.stdin.on("data", (chunk) => {
    buffer += chunk;

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex < 0) {
        break;
      }

      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) {
        continue;
      }

      let request;
      try {
        request = JSON.parse(line);
      } catch {
        reply({
          id: "invalid",
          error: { code: "protocol", message: "invalid json" },
        });
        continue;
      }

      const method = request.method;
      const params = request.params ?? {};
      writeLog(`app-server:${method}`);

      // Legacy protocol (kept for backward compatibility tests)
      if (method === "turn.start") {
        reply({
          id: request.id,
          result: {
            id: "turn-start-legacy",
            type: "turn.completed",
            outputText: `app:${String(params.text ?? "")}`,
          },
        });
        continue;
      }

      if (method === "turn.resume") {
        reply({
          id: request.id,
          result: {
            id: "turn-resume-legacy",
            type: "turn.completed",
            outputText: "app:resumed",
          },
        });
        continue;
      }

      if (method === "turn.interrupt") {
        reply({
          id: request.id,
          result: { ok: true },
        });
        continue;
      }

      // Modern slash protocol used by real codex app-server
      if (method === "initialize") {
        reply({
          id: request.id,
          result: {
            userAgent: "codex-fake/0.0.1",
            platformFamily: "unix",
            platformOs: "macos",
          },
        });
        continue;
      }

      if (method === "thread/start") {
        const thread = createThread();
        threads.set(thread.id, thread);
        reply({
          id: request.id,
          result: {
            thread: serializeThread(thread, true),
            model: "gpt-5.3-codex",
            modelProvider: "fake",
            cwd: thread.cwd,
            approvalPolicy: "never",
          },
        });
        notify("thread/started", { thread: serializeThread(thread, true) });
        continue;
      }

      if (method === "turn/start") {
        const threadId = String(params.threadId ?? "");
        const thread = threads.get(threadId);
        if (!thread) {
          reply({
            id: request.id,
            error: { code: "execution", message: `thread not found: ${threadId}` },
          });
          continue;
        }

        const inputItems = Array.isArray(params.input) ? params.input : [];
        const prompt = extractPrompt(inputItems);
        const turn = {
          id: nextTurnId(),
          status: "inProgress",
          error: null,
          items: [],
          prompt,
        };
        thread.turns.push(turn);
        thread.status = "active";

        reply({
          id: request.id,
          result: {
            turn: {
              id: turn.id,
              items: [],
              status: "inProgress",
              error: null,
            },
          },
        });

        notify("thread/status/changed", {
          threadId: thread.id,
          status: { type: "active", activeFlags: [] },
        });
        notify("turn/started", {
          threadId: thread.id,
          turn: { id: turn.id, items: [], status: "inProgress", error: null },
        });

        setTimeout(() => {
          if (turn.status === "interrupted") {
            return;
          }

          const outputText = `app:${prompt}`;
          turn.status = "completed";
          turn.items = [
            {
              type: "userMessage",
              id: `item-user-${turn.id}`,
              content: [{ type: "text", text: prompt, text_elements: [] }],
            },
            {
              type: "agentMessage",
              id: `item-agent-${turn.id}`,
              text: outputText,
              phase: "final_answer",
              memoryCitation: null,
            },
          ];
          thread.status = "idle";

          notify("item/completed", {
            threadId: thread.id,
            turnId: turn.id,
            item: turn.items[1],
          });
          notify("thread/status/changed", {
            threadId: thread.id,
            status: { type: "idle" },
          });
          notify("turn/completed", {
            threadId: thread.id,
            turn: { id: turn.id, items: [], status: "completed", error: null },
          });
        }, 20);

        continue;
      }

      if (method === "thread/read") {
        const threadId = String(params.threadId ?? "");
        const thread = threads.get(threadId);
        if (!thread) {
          reply({
            id: request.id,
            error: { code: "execution", message: `thread not found: ${threadId}` },
          });
          continue;
        }

        const includeTurns = Boolean(params.includeTurns);
        reply({
          id: request.id,
          result: {
            thread: serializeThread(thread, includeTurns),
          },
        });
        continue;
      }

      if (method === "turn/interrupt") {
        const threadId = String(params.threadId ?? "");
        const turnId = String(params.turnId ?? "");
        const thread = threads.get(threadId);
        const turn = thread?.turns.find((item) => item.id === turnId);
        if (!thread || !turn) {
          reply({
            id: request.id,
            error: { code: "execution", message: "turn not found" },
          });
          continue;
        }

        turn.status = "interrupted";
        thread.status = "idle";
        reply({ id: request.id, result: {} });
        notify("thread/status/changed", {
          threadId: thread.id,
          status: { type: "idle" },
        });
        notify("turn/completed", {
          threadId: thread.id,
          turn: { id: turn.id, items: [], status: "interrupted", error: null },
        });
        continue;
      }

      reply({
        id: request.id,
        error: {
          code: "execution",
          message: `unsupported method: ${String(method)}`,
        },
      });
    }
  });
}

function createThread() {
  const id = `thread-${Date.now()}-${threadSeq++}`;
  return {
    id,
    preview: "",
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
    cwd: process.cwd(),
    turns: [],
    status: "idle",
  };
}

function nextTurnId() {
  return `turn-${Date.now()}-${turnSeq++}`;
}

function serializeThread(thread, includeTurns) {
  return {
    id: thread.id,
    preview: thread.preview,
    ephemeral: false,
    modelProvider: "fake",
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    status: { type: thread.status },
    path: `/tmp/${thread.id}.jsonl`,
    cwd: thread.cwd,
    cliVersion: "0.0.1",
    source: "vscode",
    agentNickname: null,
    agentRole: null,
    gitInfo: null,
    name: null,
    turns: includeTurns
      ? thread.turns.map((turn) => ({
          id: turn.id,
          items: turn.items,
          status: turn.status,
          error: turn.error,
        }))
      : [],
  };
}

function extractPrompt(inputItems) {
  for (const item of inputItems) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (item.type !== "text") {
      continue;
    }

    if (typeof item.text === "string") {
      return item.text;
    }
  }

  return "";
}

function reply(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function notify(method, params) {
  process.stdout.write(`${JSON.stringify({ method, params })}\n`);
}

if (args[0] === "--version") {
  runVersion();
} else if (args[0] === "exec") {
  runExec();
} else if (args[0] === "app-server") {
  runAppServer();
} else {
  process.stderr.write(`Unsupported fake codex args: ${args.join(" ")}\n`);
  process.exit(2);
}
