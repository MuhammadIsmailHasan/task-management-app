import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The share token is in the URL: keep it out of Referer headers and out of search indexes (Req 18.19).
  async headers() {
    return [
      {
        source: "/shared/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      {
        source: "/invite/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
