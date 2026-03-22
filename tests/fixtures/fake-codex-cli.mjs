#!/usr/bin/env node
import fs from "node:fs";

const args = process.argv.slice(2);

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
        process.stdout.write(
          JSON.stringify({
            id: "invalid",
            error: { code: "protocol", message: "invalid json" },
          }) + "\n",
        );
        continue;
      }

      const method = request.method;
      const params = request.params ?? {};
      writeLog(`app-server:${method}`);

      if (method === "turn.start") {
        process.stdout.write(
          JSON.stringify({
            id: request.id,
            result: {
              id: "turn-start-1",
              type: "turn.completed",
              outputText: `app:${String(params.text ?? "")}`,
            },
          }) + "\n",
        );
        continue;
      }

      if (method === "turn.resume") {
        process.stdout.write(
          JSON.stringify({
            id: request.id,
            result: {
              id: "turn-resume-1",
              type: "turn.completed",
              outputText: "app:resumed",
            },
          }) + "\n",
        );
        continue;
      }

      if (method === "turn.interrupt") {
        process.stdout.write(
          JSON.stringify({
            id: request.id,
            result: { ok: true },
          }) + "\n",
        );
        continue;
      }

      process.stdout.write(
        JSON.stringify({
          id: request.id,
          error: {
            code: "execution",
            message: `unsupported method: ${String(method)}`,
          },
        }) + "\n",
      );
    }
  });
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
