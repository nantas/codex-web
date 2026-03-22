const DEFAULT_BASE_URL = "http://localhost:43173";
const DEFAULT_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_000;

async function main() {
  const startedAt = new Date().toISOString();
  const baseUrl = (process.env.VALIDATE_REAL_CODEX_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const githubId = process.env.VALIDATE_REAL_CODEX_GITHUB_ID || "real-codex-smoke";
  const timeoutMs = Number.parseInt(
    process.env.VALIDATE_REAL_CODEX_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS),
    10,
  );

  const summary = {
    startedAt,
    baseUrl,
    githubId,
    sessionId: null,
    operationId: null,
    approvalId: null,
    statusBeforeDecision: null,
    finalStatus: null,
  };

  const headers = {
    "content-type": "application/json",
    "x-github-id": githubId,
  };

  await assertHealth(baseUrl);

  const sessionResponse = await postJson(`${baseUrl}/api/v1/sessions`, {
    headers,
    body: {
      workspaceId: `ws-real-codex-smoke-${Date.now()}`,
      cwd: process.cwd(),
    },
  });
  summary.sessionId = sessionResponse.sessionId;

  const dangerousPrompt = [
    "Run the following command exactly and then continue:",
    "rm -rf /tmp/codex-web-real-smoke-validation",
  ].join("\n");

  const operationResponse = await postJson(`${baseUrl}/api/v1/operations`, {
    headers,
    body: {
      sessionId: sessionResponse.sessionId,
      type: "turn.start",
      input: [{ type: "text", text: dangerousPrompt }],
    },
    expectedStatus: 202,
  });
  summary.operationId = operationResponse.operationId;

  const waitingApproval = await pollOperation({
    baseUrl,
    headers,
    operationId: operationResponse.operationId,
    timeoutMs,
    targetStatuses: ["waitingApproval"],
  });
  summary.statusBeforeDecision = waitingApproval.status;

  const pendingApproval = (waitingApproval.approvals || []).find((item) => item.status === "pending");
  if (!pendingApproval?.id) {
    throw new Error("operation reached waitingApproval but pending approval id is missing");
  }
  summary.approvalId = pendingApproval.id;

  await postJson(`${baseUrl}/api/v1/approvals/${pendingApproval.id}/decision`, {
    headers,
    body: { decision: "deny" },
  });

  const failed = await pollOperation({
    baseUrl,
    headers,
    operationId: operationResponse.operationId,
    timeoutMs,
    targetStatuses: ["failed"],
  });
  summary.finalStatus = failed.status;

  console.log(JSON.stringify(summary, null, 2));
}

async function assertHealth(baseUrl) {
  const response = await fetch(`${baseUrl}/api/health`);
  if (!response.ok) {
    throw new Error(`health check failed: status=${response.status}`);
  }
}

async function pollOperation(input) {
  const deadline = Date.now() + input.timeoutMs;
  let lastStatus = "unknown";
  while (Date.now() <= deadline) {
    const response = await fetch(`${input.baseUrl}/api/v1/operations/${input.operationId}`, {
      headers: input.headers,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `poll operation failed: status=${response.status} body=${truncate(body, 400)}`,
      );
    }
    const payload = await response.json();
    lastStatus = payload.status || "unknown";
    if (input.targetStatuses.includes(lastStatus)) {
      return payload;
    }
    await wait(POLL_INTERVAL_MS);
  }

  throw new Error(
    `operation did not reach ${input.targetStatuses.join(",")} in ${input.timeoutMs}ms (lastStatus=${lastStatus})`,
  );
}

async function postJson(url, input) {
  const response = await fetch(url, {
    method: "POST",
    headers: input.headers,
    body: JSON.stringify(input.body),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `POST ${url} failed: status=${response.status} body=${truncate(body, 400)}`,
    );
  }
  if (input.expectedStatus && response.status !== input.expectedStatus) {
    const body = await response.text();
    throw new Error(
      `POST ${url} expected status=${input.expectedStatus} got=${response.status} body=${truncate(body, 400)}`,
    );
  }
  return response.json();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
