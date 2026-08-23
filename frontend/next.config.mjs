/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the sibling workspace package's TypeScript directly so no separate
  // `dist` build step is required on Vercel (fixes the module-not-found deploy error).
  transpilePackages: ["qroute-aggregator-routing-engine"],
};

export default nextConfig;
