import type { NextConfig } from "next";
import path from "node:path";

const repoRoot = path.join(import.meta.dirname, "..", "..");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

module.exports = {
    allowedDevOrigins: ['192.168.1.8'],
}

export default nextConfig;