ALTER TABLE "tote-bag"."variants"
ADD COLUMN "unit_cost" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "tote-bag"."products"
DROP COLUMN "base_price",
DROP COLUMN "min_price",
DROP COLUMN "compare_price",
DROP COLUMN "cost_price";
