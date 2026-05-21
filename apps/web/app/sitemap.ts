import { MetadataRoute } from 'next';
import { getPublicAppBaseUrl } from '@/lib/env';
import { apiFetch } from '@/utils/api';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicAppBaseUrl()?.toString().replace(/\/$/, '') || 'https://totebag.shop';

  // Static routes
  const routes = ['', '/catalog', '/about', '/corporativo', '/beneficios', '/envios'].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: route === '' ? 1 : 0.8,
    })
  );

  // Dynamic product routes
  try {
    const res = await apiFetch('/catalog/products?limit=100', {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (res.ok) {
      const response: ApiResponse<Product[]> = await res.json();
      const productRoutes = response.data.map((product) => ({
        url: `${baseUrl}/catalog/${product.slug}`,
        lastModified: new Date(product.updatedAt || new Date()),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
      return [...routes, ...productRoutes];
    }
  } catch {
    // Gracefully fall back to static routes when the API is unavailable at build time.
  }

  return routes;
}
