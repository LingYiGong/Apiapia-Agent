/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.INTERNAL_API_URL || "http://backend:8000/api"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
