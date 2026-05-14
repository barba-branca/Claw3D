import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["openclaw", "@napi-rs/canvas"],
};

export default nextConfig;
