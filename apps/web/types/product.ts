export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Variant {
  id?: string;
  sku: string;
  color: string;
  imageUrl: string;
  stock: number;
}

export interface Attribute {
  id: string;
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
  basePrice: number;
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
