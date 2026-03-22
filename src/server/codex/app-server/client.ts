export function parseAppServerLine(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}
