import { MetadataRoute } from 'next';
import { getPublicAppBaseUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicAppBaseUrl()?.toString() || 'https://totebag.shop';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/auth/',
          '/checkout/',
          '/profile/',
          '/reset-password/',
          '/forgot-password/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
