import type { NextConfig } from "next";

const NO_REFERRER = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      { source: "/app/shared/:path*", headers: NO_REFERRER },
      { source: "/app/invite/:path*", headers: NO_REFERRER },
      { source: "/app/verify", headers: NO_REFERRER },
    ];
  },
  async rewrites() {
    const backend = process.env.INTERNAL_API_URL?.replace(/\/$/, "");
    return backend && process.env.NODE_ENV !== "production" ? [{ source: "/app/api/:path*", destination: `${backend}/:path*` }] : [];
  },
};

export default nextConfig;
