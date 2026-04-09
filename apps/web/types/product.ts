export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Variant {
  id?: string;
  sku: string;
  size?: string;
  color: string;
  imageUrl: string;
  salePrice?: number;
  minPrice?: number;
  comparePrice?: number;
  costPrice?: number;
  stock: number;
  isActive?: boolean;
}

export interface Attribute {
  id: string;
  // SIZE remains only for legacy compatibility while catalog data is normalized.
  type: 'SIZE' | 'MATERIAL' | 'QUALITY' | 'LINE';
  value: string;
  priceModifier: number;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  // Deprecated as commercial source of truth. Keep only as compatibility snapshot
  // while remaining consumers migrate to variant pricing.
  basePrice: number;
  minPrice?: number;
  costPrice?: number;
  comparePrice?: number; // Precio tachado
  images: ProductImage[];
  variants: Variant[];
  collectionId?: string;
  collection?: {
    name: string;
    slug: string;
  };
  tags: string[];
  attributes?: Attribute[];
}
