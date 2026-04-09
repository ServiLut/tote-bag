UPDATE "tote-bag"."variants"
SET
  "color" = BTRIM("color"),
  "size" = NULLIF(BTRIM("size"), '');

DO $$
DECLARE
  duplicate_combination RECORD;
BEGIN
  SELECT
    "product_id",
    LOWER(COALESCE("size", '')) AS normalized_size,
    LOWER("color") AS normalized_color,
    COUNT(*) AS total
  INTO duplicate_combination
  FROM "tote-bag"."variants"
  WHERE "is_active" = true
  GROUP BY
    "product_id",
    LOWER(COALESCE("size", '')),
    LOWER("color")
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_combination IS NOT NULL THEN
    RAISE EXCEPTION
      USING MESSAGE = FORMAT(
        'No se puede crear el indice unico de combinacion porque ya existen variantes activas duplicadas para product_id=%s, size=%s, color=%s.',
        duplicate_combination.product_id,
        duplicate_combination.normalized_size,
        duplicate_combination.normalized_color
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "variants_product_active_combination_ci_unique"
ON "tote-bag"."variants" (
  "product_id",
  LOWER(COALESCE("size", '')),
  LOWER("color")
)
WHERE "is_active" = true;
