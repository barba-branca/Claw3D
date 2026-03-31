import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["openclaw", "@napi-rs/canvas"],
  },
};

export default nextConfig;
