import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output for the single-image container (ticket 03b).
  output: "standalone",
};

export default nextConfig;
