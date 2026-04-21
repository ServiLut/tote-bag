export type BasePriceReferenceStatus =
  | 'DONE'
  | 'PARTIAL'
  | 'MISSING'
  | 'CONFLICT';

export type BasePriceReferenceTarget = {
  code: 'CRUDO_REF_1' | 'CRUDO_REF_2' | 'COLECCION' | 'MASCOTAS';
  label: string;
  targetGrossPrice: number;
  exactSlug: string;
  exactName: string;
  collectionSlug?: string;
};

export const BASE_PRICE_REFERENCE_TARGETS: BasePriceReferenceTarget[] = [
  {
    code: 'CRUDO_REF_1',
    label: 'Bolsa Cruda REF 1',
    targetGrossPrice: 29900,
    exactSlug: 'bolsa-cruda-ref-1',
    exactName: 'Bolsa Cruda REF 1',
    collectionSlug: 'crudo',
  },
  {
    code: 'CRUDO_REF_2',
    label: 'Bolsa Cruda REF 2',
    targetGrossPrice: 34900,
    exactSlug: 'bolsa-cruda-ref-2',
    exactName: 'Bolsa Cruda REF 2',
    collectionSlug: 'crudo',
  },
  {
    code: 'COLECCION',
    label: 'Bolsa Coleccion',
    targetGrossPrice: 44300,
    exactSlug: 'bolsa-coleccion',
    exactName: 'Bolsa Coleccion',
    collectionSlug: 'coleccion',
  },
  {
    code: 'MASCOTAS',
    label: 'Bolsa Personalizada (Mascotas)',
    targetGrossPrice: 59900,
    exactSlug: 'bolsa-personalizada-mascotas',
    exactName: 'Bolsa Personalizada (Mascotas)',
    collectionSlug: 'mascotas',
  },
];
