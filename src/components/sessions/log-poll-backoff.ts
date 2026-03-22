export function computeLogPollDelayMs({
  pollIntervalMs,
  filtered,
  failures,
  maxDelayMs = 30000,
  random = Math.random,
}: {
  pollIntervalMs: number;
  filtered: boolean;
  failures: number;
  maxDelayMs?: number;
  random?: () => number;
}): number {
  if (!filtered) {
    return pollIntervalMs;
  }

  const baseDelay = Math.min(pollIntervalMs * 2 ** failures, maxDelayMs);
  if (failures <= 0) {
    return baseDelay;
  }

  // Add 0~25% jitter on retry delay to reduce synchronized bursts.
  const jitteredDelay = Math.round(baseDelay * (1 + random() * 0.25));
  return Math.min(jitteredDelay, maxDelayMs);
}
