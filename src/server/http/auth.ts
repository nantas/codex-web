export function getRequestGithubId(req: Request): string {
  return req.headers.get("x-github-id") ?? "dev-github-id";
}
