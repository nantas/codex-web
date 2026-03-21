import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function buildGithubOauthUrl({ appUrl, nextAuthUrl }) {
  const base = normalizeBaseUrl(appUrl ?? nextAuthUrl ?? "http://localhost:43173");
  const callbackUrl = encodeURIComponent("/sessions");
  return `${base}/api/auth/signin?callbackUrl=${callbackUrl}`;
}

function normalizeBaseUrl(raw) {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function readEnvFromFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return {};

  const parsed = {};
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    parsed[key] = value;
  }
  return parsed;
}

function getOpenCommand(url) {
  if (process.platform === "darwin") {
    return ["open", [url]];
  }

  if (process.platform === "win32") {
    return ["cmd", ["/c", "start", "", url]];
  }

  return ["xdg-open", [url]];
}

function openInBrowser(url) {
  const [command, args] = getOpenCommand(url);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
    });

    child.on("error", reject);
    child.on("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function main() {
  const fileEnv = readEnvFromFile();
  const url = buildGithubOauthUrl({
    appUrl: process.env.APP_URL ?? fileEnv.APP_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL ?? fileEnv.NEXTAUTH_URL,
  });

  try {
    await openInBrowser(url);
    console.log(`Opened browser for OAuth: ${url}`);
  } catch {
    console.error("Failed to auto-open browser. Open this URL manually:");
    console.error(url);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
