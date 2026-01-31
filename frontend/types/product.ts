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
}
