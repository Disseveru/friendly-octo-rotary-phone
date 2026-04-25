import type { NextConfig } from "next";

const config: NextConfig = {
  // Bundle server packages for Node.js runtime (required for mcp-handler/x402-mcp)
  serverExternalPackages: ["x402-mcp", "mcp-handler", "x402"],
};

export default config;
