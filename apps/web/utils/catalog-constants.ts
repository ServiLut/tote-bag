export const CATALOG_ATTRIBUTES = {
  LINE: ['ECO', 'COMERCIAL', 'PREMIUM', 'CORPORATIVA'],
  SIZE: ['Pequeña', 'Estándar', 'Grande'],
  MATERIAL: ['Lona', 'Algodón', 'Poliéster', 'Cuero Sintético'],
  QUALITY: ['Económica', 'Comercial', 'Premium'],
} as const;

export type AttributeType = keyof typeof CATALOG_ATTRIBUTES;
