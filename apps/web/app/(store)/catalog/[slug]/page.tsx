import { notFound } from 'next/navigation';
import ProductDetailClient from '@/components/store/ProductDetailClient';
import ProductCard from '@/components/store/ProductCard';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { CatalogProductFetchResult, resolveCatalogProductResponse } from '@/lib/catalog-product';
import { Metadata } from 'next';
import { apiFetch } from '@/utils/api';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string): Promise<CatalogProductFetchResult<Product>> {
  try {
    const res = await apiFetch(`/catalog/slug/${slug}`, {
      next: { revalidate: 60 }, // Revalidate every minute
    });

    return resolveCatalogProductResponse<Product>(res);
  } catch (error) {
    console.error(error);
    return { kind: 'unavailable' };
  }
}

async function getRelatedProducts(currentProductId: string, collectionId?: string): Promise<Product[]> {
  try {
    let products: Product[] = [];

    // 1. Try fetching from same collection if available
    if (collectionId) {
      const res = await apiFetch(`/catalog/products?collection=${collectionId}&limit=5`, {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const response: ApiResponse<Product[]> = await res.json();
        products = response.data;
      }
    }

    // Filter out current product
    let related = products.filter((p: Product) => p.id !== currentProductId);

    // 2. If no products found (or only the current one existed in collection), fetch general list
    if (related.length === 0) {
      const res = await apiFetch('/catalog/products?limit=5', { next: { revalidate: 60 } });
      if (res.ok) {
        const response: ApiResponse<Product[]> = await res.json();
        // Filter out current product from general list
        related = response.data.filter((p: Product) => p.id !== currentProductId);
      }
    }
    
    return related.slice(0, 4);
      
  } catch (error) {
    console.error('Error fetching related products:', error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const productResult = await getProduct(slug);

  if (productResult.kind === 'missing') {
    return {
      title: 'Producto no encontrado | Tote Bag Shop',
    };
  }

  if (productResult.kind === 'unavailable') {
    return {
      title: 'Catalogo | Tote Bag Shop',
    };
  }

  const { product } = productResult;

  return {
    title: `${product.name} | Tote Bag Shop`,
    description: product.description,
    openGraph: {
      images: product.images[0] ? [product.images[0].url] : [],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const productResult = await getProduct(slug);

  if (productResult.kind === 'missing') {
    notFound();
  }

  if (productResult.kind === 'unavailable') {
    throw new Error(`Catalog product ${slug} is temporarily unavailable.`);
  }

  const { product } = productResult;

  const relatedProducts = await getRelatedProducts(product.id, product.collectionId);

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <ProductDetailClient product={product} />

        {relatedProducts.length > 0 && (
          <div className="mt-24 border-t border-theme pt-16">
            <h2 className="text-2xl font-serif font-bold text-primary mb-8">
              También te podría gustar
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} />
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
