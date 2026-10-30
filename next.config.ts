import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Excel uploads send every row of a sheet in one action (default is 1mb).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
