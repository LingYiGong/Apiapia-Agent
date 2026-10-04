/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === "true" || process.env.CF_PAGES === "1";

const nextConfig = {
  output: isExport ? "export" : "standalone",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
};

export default nextConfig;

