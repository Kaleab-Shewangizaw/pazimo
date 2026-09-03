/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js sends this by default; noted as a fingerprinting leak in the
  // 2026-09-03 security report. This is the file actually shadowing
  // next.config.ts on the live build (see docs/PAZIMO_PLAN.md / deployment
  // notes) — set here too so it takes effect until that's resolved.
  poweredByHeader: false,
  images: {
    domains: ["localhost", "pazimo.com", "pazimoapp.testserveret.com"],
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // These options have been moved out of experimental
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,

  // Set the production API URL
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://pazimoapp.testserveret.com"
        : "http://localhost:5000"),
    NEXT_PUBLIC_FRONTEND_URL:
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://pazimo.vercel.app"
        : "http://localhost:3000"),
  },
};

module.exports = nextConfig;
