/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'pazimo.com'],
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
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' 
      ? 'https://pazimo.com' 
      : 'http://localhost:5000',
  },
}

module.exports = nextConfig 