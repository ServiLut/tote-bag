import type { NextConfig } from 'next';
import path from 'path';

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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
};

export default nextConfig;
