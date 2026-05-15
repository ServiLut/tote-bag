import type { NextConfig } from 'next';
import path from 'path';
import { DASHBOARD_ROUTE_ALIASES } from './lib/dashboard-route-aliases';

function getImageRemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const hosts = new Set<string>();
  const configuredHosts = process.env.NEXT_IMAGE_REMOTE_HOSTS?.split(',') ?? [];

  for (const host of configuredHosts) {
    const normalizedHost = host.trim();
    if (normalizedHost) {
      hosts.add(normalizedHost);
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    try {
      const hostname = new URL(supabaseUrl).hostname;
      if (hostname !== 'placeholder.supabase.co') {
        hosts.add(hostname);
      }
    } catch {
      // Invalid Supabase URLs are validated elsewhere; keep image config narrow.
    }
  }

  if (hosts.size === 0) {
    // En producción, no permitir cualquier host por defecto.
    console.warn('⚠️ No image remote hosts configured. Remote images may not load.');
  }

  return Array.from(hosts).map((hostname) => ({
    protocol: 'https',
    hostname,
  }));
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.54', '*.ngrok-free.dev'],
  transpilePackages: ['@tote-bag/ui'],
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  async redirects() {
    return DASHBOARD_ROUTE_ALIASES.map((alias) => ({
      ...alias,
      permanent: true,
    }));
  },
  images: {
    remotePatterns: getImageRemotePatterns(),
  },
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
};

export default nextConfig;
