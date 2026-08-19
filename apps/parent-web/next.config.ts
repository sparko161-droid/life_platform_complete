import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @life/* workspace packages ship TypeScript-built ESM; Next must
  // transpile them rather than treat them as prebuilt externals.
  transpilePackages: ["@life/ui", "@life/ux-contracts", "@life/web-session"],
};

export default nextConfig;
