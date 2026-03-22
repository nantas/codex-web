export function getCodexCommand() {
  const configured = process.env.CODEX_BIN?.trim();
  if (configured) {
    return configured;
  }
  return "codex";
}
