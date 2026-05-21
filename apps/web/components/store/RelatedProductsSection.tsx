'use client';

import { Product } from '@/types/product';
import { useTranslation } from 'react-i18next';
import ProductCard from '@/components/store/ProductCard';

interface RelatedProductsSectionProps {
  products: Product[];
}

export default function RelatedProductsSection({
  products,
}: RelatedProductsSectionProps) {
  const { t } = useTranslation();

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="mt-24 border-t border-theme pt-16">
      <h2 className="mb-8 text-2xl font-serif font-bold text-primary">
        {t('product_related_title')}
      </h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((related) => (
          <ProductCard key={related.id} product={related} />
        ))}
      </div>
    </div>
  );
}
