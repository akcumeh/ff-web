import type { NextConfig } from "next";
import path from "node:path";

const repoRoot = path.join(import.meta.dirname, "..", "..");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  allowedDevOrigins: ["*.*.*.*", "*.local"],
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/+$/, "");
    return ["/events", "/visitors/:path*", "/orders", "/orders/:path*", "/tryon", "/config"].map((p) => ({
      source: `/ffapi${p}`,
      destination: `${api}${p}`,
    }));
  },
};

export default nextConfig;
