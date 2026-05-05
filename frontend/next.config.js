/** @type {import('next').NextConfig} */
const nextConfig = {
  // Forward /backend/* → Railway backend URL during development
  // In production on Vercel, set NEXT_PUBLIC_API_URL directly
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
