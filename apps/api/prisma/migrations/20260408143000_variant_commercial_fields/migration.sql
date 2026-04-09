ALTER TABLE "tote-bag"."variants"
ADD COLUMN IF NOT EXISTS "size" TEXT,
ADD COLUMN IF NOT EXISTS "sale_price" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "min_price" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "compare_price" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "cost_price" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "variants_product_id_size_idx"
ON "tote-bag"."variants"("product_id", "size");

CREATE INDEX IF NOT EXISTS "variants_product_id_is_active_idx"
ON "tote-bag"."variants"("product_id", "is_active");

-- Backfill variant commercial fields from the current product-level source of truth.
UPDATE "tote-bag"."variants" AS v
SET
  "sale_price" = COALESCE(v."sale_price", p."base_price"),
  "min_price" = COALESCE(v."min_price", p."min_price"),
  "compare_price" = COALESCE(v."compare_price", p."compare_price"),
  "cost_price" = COALESCE(v."cost_price", p."cost_price"),
  "is_active" = COALESCE(v."is_active", true)
FROM "tote-bag"."products" AS p
WHERE p."id" = v."product_id";

-- Only infer size automatically when the product has exactly one active SIZE attribute.
WITH "single_size_products" AS (
  SELECT
    pa."product_id",
    MAX(pa."value") AS "size_value"
  FROM "tote-bag"."product_attributes" AS pa
  WHERE pa."type" = 'SIZE'::"tote-bag"."AttributeType"
    AND pa."is_active" = true
  GROUP BY pa."product_id"
  HAVING COUNT(*) = 1
)
UPDATE "tote-bag"."variants" AS v
SET "size" = s."size_value"
FROM "single_size_products" AS s
WHERE s."product_id" = v."product_id"
  AND v."size" IS NULL;

-- Transitional compatibility: keep SIZE rows for legacy UIs/filters, but stop using them as price modifiers.
UPDATE "tote-bag"."product_attributes"
SET "price_modifier" = 0
WHERE "type" = 'SIZE'::"tote-bag"."AttributeType"
  AND COALESCE("price_modifier", 0) <> 0;

-- Transitional compatibility: global dimension options remain selectable metadata, not price modifiers.
UPDATE "tote-bag"."wizard_options"
SET "base_price_modifier" = 0
WHERE "category" = 'DIMENSION'::"tote-bag"."WizardCategory"
  AND COALESCE("base_price_modifier", 0) <> 0;
