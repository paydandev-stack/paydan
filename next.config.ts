import type { NextConfig } from "next";

const mediaCdn = process.env.MEDIA_CDN_URL
  ? new URL(process.env.MEDIA_CDN_URL)
  : null;
if (
  mediaCdn &&
  (mediaCdn.protocol !== "https:" ||
    mediaCdn.username ||
    mediaCdn.password ||
    mediaCdn.search ||
    mediaCdn.hash)
)
  throw new Error(
    "MEDIA_CDN_URL must be a public HTTPS origin without credentials, a query, or a fragment.",
  );
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
