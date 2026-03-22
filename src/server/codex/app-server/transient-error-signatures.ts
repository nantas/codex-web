export const TRANSIENT_APP_SERVER_ERROR_SIGNATURES = [
  ["not materialized yet"],
  ["includeturns is unavailable"],
  ["failed to load rollout", "empty session file"],
] as const;

export function matchesTransientSignature(message: string) {
  const lower = message.toLowerCase();
  return TRANSIENT_APP_SERVER_ERROR_SIGNATURES.some((signature) =>
    signature.every((part) => lower.includes(part)),
  );
}
