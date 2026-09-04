import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Demo predloga SQLite baze morata priti v Vercel serverless funkcijo
  // (file tracing — sicer bi datotečni sistem funkcije bil brez nje).
  outputFileTracingIncludes: {
    "/**": ["./db/demo-template.db"],
    "/api/**": ["./db/demo-template.db"],
  },
};

export default nextConfig;
