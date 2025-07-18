import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
        pathname: '/private/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.openai.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.runwayml.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
