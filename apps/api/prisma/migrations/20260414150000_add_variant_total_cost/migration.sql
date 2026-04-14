ALTER TABLE "tote-bag"."variants"
ADD COLUMN IF NOT EXISTS "total_cost" DOUBLE PRECISION;

UPDATE "tote-bag"."variants"
SET "total_cost" = "cost_price"
WHERE "total_cost" IS NULL
  AND "cost_price" IS NOT NULL;
