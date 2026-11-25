import type { NextConfig } from "next";
import { mediaCdnBase } from "./src/lib/media-origin";

const mediaCdn = mediaCdnBase(process.env.MEDIA_CDN_URL);
const mediaCdnPath = mediaCdn
  ? `${mediaCdn.pathname.replace(/\/+$/, "")}/catalog/**`
  : null;

const nextConfig: NextConfig = {
  // A lockfile exists higher up the Desktop folder; keep this app as the root.
  turbopack: { root: __dirname },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...(mediaCdn && mediaCdnPath
        ? [
            {
              protocol: "https" as const,
              hostname: mediaCdn.hostname,
              port: mediaCdn.port,
              pathname: mediaCdnPath,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
