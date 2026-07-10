import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@fundos/core', '@fundos/pipeline'],
};

export default nextConfig;
