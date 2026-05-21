import { notFound } from 'next/navigation';
import ProductDetailClient from '@/components/store/ProductDetailClient';
import RelatedProductsSection from '@/components/store/RelatedProductsSection';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import {
  CatalogProductFetchResult,
  resolveCatalogProductResponse,
} from '@/lib/catalog-product';
import { Metadata } from 'next';
import { apiFetch } from '@/utils/api';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(
  slug: string,
): Promise<CatalogProductFetchResult<Product>> {
  try {
    const res = await apiFetch(`/catalog/slug/${slug}`, {
      next: { revalidate: 60 },
    });

    return resolveCatalogProductResponse<Product>(res);
  } catch (error) {
    console.error(error);
    return { kind: 'unavailable' };
  }
}

async function getRelatedProducts(
  currentProductId: string,
  collectionId?: string,
): Promise<Product[]> {
  try {
    let products: Product[] = [];

    if (collectionId) {
      const res = await apiFetch(
        `/catalog/products?collection=${collectionId}&limit=5`,
        {
          next: { revalidate: 60 },
        },
      );
      if (res.ok) {
        const response: ApiResponse<Product[]> = await res.json();
        products = response.data;
      }
    }

    let related = products.filter((product) => product.id !== currentProductId);

    if (related.length === 0) {
      const res = await apiFetch('/catalog/products?limit=5', {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const response: ApiResponse<Product[]> = await res.json();
        related = response.data.filter(
          (product) => product.id !== currentProductId,
        );
      }
    }

    return related.slice(0, 4);
  } catch (error) {
    console.error('Error fetching related products:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
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
  const title = product.seoTitle?.trim() || `${product.name} | Tote Bag Shop`;
  const description =
    product.seoDescription?.trim()
    || product.description
    || 'Consulta disponibilidad, tiempos y opciones de personalizacion de esta tote bag.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
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
    <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <ProductDetailClient product={product} />
      <RelatedProductsSection products={relatedProducts} />
    </main>
  );
}
