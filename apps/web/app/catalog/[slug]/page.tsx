import { notFound } from 'next/navigation';
import Navbar from '@/components/store/Navbar';
import CartDrawer from '@/components/store/CartDrawer';
import ProductDetailClient from '@/components/store/ProductDetailClient';
import ProductCard from '@/components/store/ProductCard';
import Footer from '@/components/store/Footer';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/products/slug/${slug}`, {
      next: { revalidate: 60 }, // Revalidate every minute
    });
    
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch product');
    }
    
    const response: ApiResponse<Product> = await res.json();
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getRelatedProducts(currentProductId: string, collectionId?: string): Promise<Product[]> {
  try {
    let products: Product[] = [];

    // 1. Try fetching from same collection if available
    if (collectionId) {
      const endpoint = `${API_URL}/products/list?collection=${collectionId}`;
      const res = await fetch(endpoint, { next: { revalidate: 60 } });
      if (res.ok) {
        const response: ApiResponse<Product[]> = await res.json();
        products = response.data;
      }
    }

    // Filter out current product
    let related = products.filter(p => p.id !== currentProductId);

    // 2. If no products found (or only the current one existed in collection), fetch general list
    if (related.length === 0) {
      const res = await fetch(`${API_URL}/products/list`, { next: { revalidate: 60 } });
      if (res.ok) {
        const response: ApiResponse<Product[]> = await res.json();
        // Filter out current product from general list
        related = response.data.filter(p => p.id !== currentProductId);
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
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: 'Producto no encontrado | Tote Bag Shop',
    };
  }

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
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product.id, product.collectionId);

  return (
    <div className="min-h-screen bg-base transition-colors duration-300">
      <Navbar />
      <CartDrawer />
      
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

      <Footer />
    </div>
  );
}
