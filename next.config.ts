import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "*": ["./raw_trades.json", "./raw_rents.json", "./KakaoTalk_20260720_194635070.png"],
  },
};

export default nextConfig;
