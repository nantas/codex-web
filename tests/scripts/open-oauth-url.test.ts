import { describe, expect, it } from "vitest";
import { buildGithubOauthUrl } from "../../scripts/open-oauth-url.mjs";

describe("buildGithubOauthUrl", () => {
  it("uses APP_URL first and falls back to localhost", () => {
    expect(
      buildGithubOauthUrl({
        appUrl: "https://app.example.com",
        nextAuthUrl: "https://nextauth.example.com",
      }),
    ).toBe("https://app.example.com/api/auth/signin/github?callbackUrl=%2Fsessions");

    expect(buildGithubOauthUrl({ appUrl: undefined, nextAuthUrl: undefined })).toBe(
      "http://localhost:3000/api/auth/signin/github?callbackUrl=%2Fsessions",
    );
  });
});
