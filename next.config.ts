import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:43173",
    "http://127.0.0.1:43173",
    "http://nantas-home.crane-moth.ts.net:43173",
  ],
};

export default nextConfig;
