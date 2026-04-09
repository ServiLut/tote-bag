UPDATE "tote-bag"."variants"
SET
  "sku" = BTRIM("sku"),
  "color" = BTRIM("color"),
  "size" = NULLIF(BTRIM("size"), '');

DO $$
DECLARE
  duplicate_sku RECORD;
BEGIN
  SELECT
    LOWER(BTRIM("sku")) AS normalized_sku,
    COUNT(*) AS total
  INTO duplicate_sku
  FROM "tote-bag"."variants"
  GROUP BY LOWER(BTRIM("sku"))
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_sku IS NOT NULL THEN
    RAISE EXCEPTION
      USING MESSAGE = FORMAT(
        'No se puede crear el indice unico case-insensitive de SKU porque ya existe duplicidad normalizada para "%s".',
        duplicate_sku.normalized_sku
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "variants_sku_ci_unique"
ON "tote-bag"."variants" (LOWER(BTRIM("sku")));
