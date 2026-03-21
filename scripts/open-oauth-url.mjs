import { spawn } from "node:child_process";

export function buildGithubOauthUrl({ appUrl, nextAuthUrl }) {
  const base = normalizeBaseUrl(appUrl ?? nextAuthUrl ?? "http://localhost:3000");
  const callbackUrl = encodeURIComponent("/sessions");
  return `${base}/api/auth/signin/github?callbackUrl=${callbackUrl}`;
}

function normalizeBaseUrl(raw) {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
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
  const url = buildGithubOauthUrl({
    appUrl: process.env.APP_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL,
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
