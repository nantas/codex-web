export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/sessions/:path*", "/api/v1/:path*"],
};
