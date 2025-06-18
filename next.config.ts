import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    'http://localhost:9003',
    'https://9000-firebase-studio-1748521216876.cluster-c23mj7ubf5fxwq6nrbev4ugaxa.cloudworkstations.dev',
    'https://9003-firebase-studio-1748521216876.cluster-c23mj7ubf5fxwq6nrbev4ugaxa.cloudworkstations.dev',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '', // Keep this as an empty string or a valid port number if needed
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
