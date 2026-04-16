import type { NextConfig } from 'next';
import path from 'path';

function getImageRemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const hosts = new Set<string>();
  const configuredHosts = process.env.NEXT_IMAGE_REMOTE_HOSTS?.split(',') ?? [];
  const hasExplicitHostAllowlist = configuredHosts.some((host) => host.trim());

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
    hosts.add('**');
  } else if (!hasExplicitHostAllowlist) {
    hosts.add('**');
  }

  return Array.from(hosts).map((hostname) => ({
    protocol: 'https',
    hostname,
  }));
}

const nextConfig: NextConfig = {
  transpilePackages: ['@tote-bag/ui'],
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/dashboard/finance',
        destination: '/dashboard/finanzas',
        permanent: true,
      },
      {
        source: '/dashboard/finance/cash-flow',
        destination: '/dashboard/finanzas/cash-flow',
        permanent: true,
      },
      {
        source: '/dashboard/finance/opex',
        destination: '/dashboard/finanzas/opex',
        permanent: true,
      },
      {
        source: '/dashboard/logistics/inventory',
        destination: '/dashboard/logistica/inventario',
        permanent: true,
      },
      {
        source: '/dashboard/logistics/suppliers',
        destination: '/dashboard/logistica/insumos',
        permanent: true,
      },
      {
        source: '/dashboard/compras/proveedores',
        destination: '/dashboard/logistica/insumos',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: getImageRemotePatterns(),
  },
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
};

export default nextConfig;
