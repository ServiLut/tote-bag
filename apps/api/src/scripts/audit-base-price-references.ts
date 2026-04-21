import pg from 'pg';
import * as dotenv from 'dotenv';
import {
  BASE_PRICE_REFERENCE_TARGETS,
  BasePriceReferenceStatus,
  BasePriceReferenceTarget,
} from './base-price-reference-targets';

dotenv.config();

type VariantRow = {
  sku: string;
  size: string | null;
  color: string;
  salePrice: number | null;
  minPrice: number | null;
  comparePrice: number | null;
  isActive: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  min_price: number;
  compare_price: number | null;
  collection_name: string | null;
  collection_slug: string | null;
  variants: VariantRow[];
};

type CandidateEvidence = {
  productName: string;
  productSlug: string;
  collectionSlug: string | null;
  referencePrice: number;
  variantSku: string | null;
};

type ReferenceAuditResult = {
  code: BasePriceReferenceTarget['code'];
  label: string;
  targetGrossPrice: number;
  status: BasePriceReferenceStatus;
  reason: string;
  evidence: CandidateEvidence[];
};

const EXACT_PRICE_TOLERANCE = 0.01;

function normalizeConnectionString(connectionString: string) {
  const stripped = connectionString.replace(/(\?|&)(sslmode|ssl)=[^&]*/g, '');

  if (!stripped.includes('?')) {
    return stripped.replace(/&/, '?');
  }

  return stripped;
}

function almostEqual(left: number, right: number) {
  return Math.abs(left - right) <= EXACT_PRICE_TOLERANCE;
}

function getReferenceVariant(product: ProductRow) {
  const activeVariants = product.variants.filter(
    (variant) =>
      variant.isActive &&
      variant.salePrice !== null &&
      Number.isFinite(variant.salePrice),
  );

  if (activeVariants.length === 0) {
    return null;
  }

  return [...activeVariants].sort(
    (left, right) => (left.salePrice ?? 0) - (right.salePrice ?? 0),
  )[0];
}

function toEvidence(
  product: ProductRow,
  referencePrice: number,
  variantSku: string | null,
): CandidateEvidence {
  return {
    productName: product.name,
    productSlug: product.slug,
    collectionSlug: product.collection_slug,
    referencePrice,
    variantSku,
  };
}

function classifyCrudoReference(
  target: BasePriceReferenceTarget,
  products: ProductRow[],
  variantIndex: number,
): ReferenceAuditResult {
  const collectionProducts = products.filter(
    (product) => product.collection_slug === 'crudo',
  );
  const exactProduct = collectionProducts.find(
    (product) =>
      product.slug === target.exactSlug || product.name === target.exactName,
  );

  if (exactProduct) {
    const exactVariant = getReferenceVariant(exactProduct);
    const exactPrice = exactVariant?.salePrice ?? exactProduct.base_price;
    return {
      code: target.code,
      label: target.label,
      targetGrossPrice: target.targetGrossPrice,
      status: almostEqual(exactPrice, target.targetGrossPrice)
        ? 'DONE'
        : 'CONFLICT',
      reason: almostEqual(exactPrice, target.targetGrossPrice)
        ? 'La referencia exacta ya existe con el precio objetivo.'
        : 'La referencia exacta existe pero con un precio distinto.',
      evidence: [
        toEvidence(exactProduct, exactPrice, exactVariant?.sku ?? null),
      ],
    };
  }

  const collectionVariants = collectionProducts
    .flatMap((product) => {
      const referenceVariant = getReferenceVariant(product);
      if (!referenceVariant || referenceVariant.salePrice === null) {
        return [];
      }

      return [
        {
          product,
          variant: referenceVariant,
        },
      ];
    })
    .sort(
      (left, right) =>
        (left.variant.salePrice ?? 0) - (right.variant.salePrice ?? 0),
    );

  const candidate = collectionVariants[variantIndex] ?? null;

  if (!candidate || candidate.variant.salePrice === null) {
    return {
      code: target.code,
      label: target.label,
      targetGrossPrice: target.targetGrossPrice,
      status: 'MISSING',
      reason:
        'No existe una referencia exacta ni una variante base suficiente para esta posicion en Crudo.',
      evidence: [],
    };
  }

  return {
    code: target.code,
    label: target.label,
    targetGrossPrice: target.targetGrossPrice,
    status: almostEqual(candidate.variant.salePrice, target.targetGrossPrice)
      ? 'PARTIAL'
      : 'CONFLICT',
    reason: almostEqual(candidate.variant.salePrice, target.targetGrossPrice)
      ? 'Existe una variante en Crudo con el precio objetivo, pero no bajo la referencia exacta.'
      : 'Ya existe una variante base en Crudo, pero el precio difiere del objetivo.',
    evidence: [
      toEvidence(
        candidate.product,
        candidate.variant.salePrice,
        candidate.variant.sku,
      ),
    ],
  };
}

function classifyCollectionReference(
  target: BasePriceReferenceTarget,
  products: ProductRow[],
): ReferenceAuditResult {
  const exactProduct = products.find(
    (product) =>
      product.slug === target.exactSlug || product.name === target.exactName,
  );

  if (exactProduct) {
    const exactVariant = getReferenceVariant(exactProduct);
    const exactPrice = exactVariant?.salePrice ?? exactProduct.base_price;
    return {
      code: target.code,
      label: target.label,
      targetGrossPrice: target.targetGrossPrice,
      status: almostEqual(exactPrice, target.targetGrossPrice)
        ? 'DONE'
        : 'CONFLICT',
      reason: almostEqual(exactPrice, target.targetGrossPrice)
        ? 'La referencia exacta ya existe con el precio objetivo.'
        : 'La referencia exacta existe pero con un precio distinto.',
      evidence: [
        toEvidence(exactProduct, exactPrice, exactVariant?.sku ?? null),
      ],
    };
  }

  const collectionCandidates = products
    .filter(
      (product) =>
        product.collection_slug !== 'crudo' &&
        product.collection_slug !== 'mascotas',
    )
    .flatMap((product) => {
      const referenceVariant = getReferenceVariant(product);
      if (!referenceVariant || referenceVariant.salePrice === null) {
        return [];
      }

      return [
        {
          product,
          variant: referenceVariant,
        },
      ];
    })
    .sort(
      (left, right) =>
        Math.abs((left.variant.salePrice ?? 0) - target.targetGrossPrice) -
        Math.abs((right.variant.salePrice ?? 0) - target.targetGrossPrice),
    );

  const candidate = collectionCandidates[0] ?? null;
  if (!candidate || candidate.variant.salePrice === null) {
    return {
      code: target.code,
      label: target.label,
      targetGrossPrice: target.targetGrossPrice,
      status: 'MISSING',
      reason:
        'No hay una referencia de coleccion cercana ni la referencia exacta definida en la base.',
      evidence: [],
    };
  }

  return {
    code: target.code,
    label: target.label,
    targetGrossPrice: target.targetGrossPrice,
    status: almostEqual(candidate.variant.salePrice, target.targetGrossPrice)
      ? 'PARTIAL'
      : 'CONFLICT',
    reason: almostEqual(candidate.variant.salePrice, target.targetGrossPrice)
      ? 'Existe una referencia de coleccion con el precio objetivo, pero no bajo la referencia exacta.'
      : 'Existe una referencia de coleccion cercana, pero con un precio distinto.',
    evidence: [
      toEvidence(
        candidate.product,
        candidate.variant.salePrice,
        candidate.variant.sku,
      ),
    ],
  };
}

function classifyMascotasReference(
  target: BasePriceReferenceTarget,
  products: ProductRow[],
): ReferenceAuditResult {
  const collectionProducts = products.filter(
    (product) => product.collection_slug === 'mascotas',
  );
  const exactProduct = collectionProducts.find(
    (product) =>
      product.slug === target.exactSlug || product.name === target.exactName,
  );

  if (exactProduct) {
    const exactVariant = getReferenceVariant(exactProduct);
    const exactPrice = exactVariant?.salePrice ?? exactProduct.base_price;
    return {
      code: target.code,
      label: target.label,
      targetGrossPrice: target.targetGrossPrice,
      status: almostEqual(exactPrice, target.targetGrossPrice)
        ? 'DONE'
        : 'CONFLICT',
      reason: almostEqual(exactPrice, target.targetGrossPrice)
        ? 'La referencia exacta ya existe con el precio objetivo.'
        : 'La referencia exacta existe pero con un precio distinto.',
      evidence: [
        toEvidence(exactProduct, exactPrice, exactVariant?.sku ?? null),
      ],
    };
  }

  const collectionCandidates = collectionProducts
    .flatMap((product) => {
      const referenceVariant = getReferenceVariant(product);
      if (!referenceVariant || referenceVariant.salePrice === null) {
        return [];
      }

      return [
        {
          product,
          variant: referenceVariant,
        },
      ];
    })
    .sort(
      (left, right) =>
        Math.abs((left.variant.salePrice ?? 0) - target.targetGrossPrice) -
        Math.abs((right.variant.salePrice ?? 0) - target.targetGrossPrice),
    );

  const candidate = collectionCandidates[0] ?? null;
  if (!candidate || candidate.variant.salePrice === null) {
    return {
      code: target.code,
      label: target.label,
      targetGrossPrice: target.targetGrossPrice,
      status: 'MISSING',
      reason:
        'No existe una referencia exacta ni una personalizada de Mascotas en la base.',
      evidence: [],
    };
  }

  return {
    code: target.code,
    label: target.label,
    targetGrossPrice: target.targetGrossPrice,
    status: almostEqual(candidate.variant.salePrice, target.targetGrossPrice)
      ? 'PARTIAL'
      : 'CONFLICT',
    reason: almostEqual(candidate.variant.salePrice, target.targetGrossPrice)
      ? 'Existe una referencia en Mascotas con el precio objetivo, pero no con la referencia exacta.'
      : 'Existe una referencia activa en Mascotas, pero el precio difiere del objetivo.',
    evidence: [
      toEvidence(
        candidate.product,
        candidate.variant.salePrice,
        candidate.variant.sku,
      ),
    ],
  };
}

export function classifyBasePriceReferences(products: ProductRow[]) {
  return BASE_PRICE_REFERENCE_TARGETS.map((target) => {
    switch (target.code) {
      case 'CRUDO_REF_1':
        return classifyCrudoReference(target, products, 0);
      case 'CRUDO_REF_2':
        return classifyCrudoReference(target, products, 1);
      case 'COLECCION':
        return classifyCollectionReference(target, products);
      case 'MASCOTAS':
        return classifyMascotasReference(target, products);
      default:
        return {
          code: target.code,
          label: target.label,
          targetGrossPrice: target.targetGrossPrice,
          status: 'MISSING' as const,
          reason: 'Objetivo no clasificado.',
          evidence: [],
        };
    }
  });
}

async function fetchProducts(pool: pg.Pool) {
  const result = await pool.query<ProductRow>(`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.base_price,
      p.min_price,
      p.compare_price,
      c.name AS collection_name,
      c.slug AS collection_slug,
      COALESCE(
        json_agg(
          json_build_object(
            'sku', v.sku,
            'size', v.size,
            'color', v.color,
            'salePrice', v.sale_price,
            'minPrice', v.min_price,
            'comparePrice', v.compare_price,
            'isActive', v.is_active
          )
          ORDER BY v.sale_price NULLS LAST, v.sku
        ) FILTER (WHERE v.id IS NOT NULL),
        '[]'::json
      ) AS variants
    FROM "tote-bag".products p
    LEFT JOIN "tote-bag".collections c ON c.id = p.collection_id
    LEFT JOIN "tote-bag".variants v ON v.product_id = p.id
    GROUP BY p.id, c.name, c.slug
    ORDER BY p.name ASC
  `);

  return result.rows;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_URL_NON_POOLING not found');
  }

  const pool = new pg.Pool({
    connectionString: normalizeConnectionString(connectionString),
    ssl: false,
  });

  try {
    const products = await fetchProducts(pool);
    const audit = classifyBasePriceReferences(products);

    console.log(JSON.stringify(audit, null, 2));
  } finally {
    await pool.end();
  }
}

void main();
