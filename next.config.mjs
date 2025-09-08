/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Disable error overlay in development
  devIndicators: {
    position: 'bottom-right',
  },
  // Disable Fast Refresh console messages
  webpack: (config, { dev }) => {
    if (dev) {
      // Suppress Fast Refresh console messages
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    return config;
  },
  // Disable error overlay
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
}

export default nextConfig
