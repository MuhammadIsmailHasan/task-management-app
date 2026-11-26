import type { NextConfig } from "next";

const NO_REFERRER = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // A share, invite, or verification token is in the URL: keep it out of Referer headers and out of search indexes (Req 18.19, ACT-07).
  async headers() {
    return [
      { source: "/app/shared/:path*", headers: NO_REFERRER },
      { source: "/app/invite/:path*", headers: NO_REFERRER },
      { source: "/app/verify", headers: NO_REFERRER },
    ];
  },
  // In development `/app/api/*` reaches the Backend the way nginx does it in production (PATH-02); the browser then
  // makes same-origin calls only. Set INTERNAL_API_URL to the Backend's /api URL, for example http://localhost:5001/api.
  async rewrites() {
    const backend = process.env.INTERNAL_API_URL?.replace(/\/$/, "");
    return backend && process.env.NODE_ENV !== "production" ? [{ source: "/app/api/:path*", destination: `${backend}/:path*` }] : [];
  },
};

export default nextConfig;
