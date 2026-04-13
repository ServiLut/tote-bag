-- Add IVA metadata to commercial variants. The existing sale_price remains the
-- gross PVP with IVA included.
ALTER TABLE "tote-bag"."variants"
ADD COLUMN "tax_rate" DECIMAL(4,2) NOT NULL DEFAULT 0.19;

-- Add sales tax breakdown fields without changing existing gross totals.
ALTER TABLE "tote-bag"."order_items"
ADD COLUMN "net_unit_price" DECIMAL(10,2),
ADD COLUMN "tax_amount" DECIMAL(10,2);

ALTER TABLE "tote-bag"."orders"
ADD COLUMN "net_amount" DECIMAL(10,2),
ADD COLUMN "tax_total" DECIMAL(10,2);

-- Backfill existing rows using the Colombian IVA rate currently implied by
-- sales pricing. ROUND(numeric, 2) gives deterministic half-up rounding in
-- PostgreSQL; order totals are backfilled independently so net + tax equals
-- the persisted gross total, including any legacy manual discount.
UPDATE "tote-bag"."order_items"
SET
  "net_unit_price" = ROUND(("unit_price"::numeric / 1.19), 2),
  "tax_amount" = ROUND(
    GREATEST(
      "total_price"::numeric - (ROUND(("unit_price"::numeric / 1.19), 2) * "quantity"),
      0
    ),
    2
  );

UPDATE "tote-bag"."orders"
SET
  "net_amount" = ROUND(("total_amount"::numeric / 1.19), 2),
  "tax_total" = ROUND(
    "total_amount"::numeric - ROUND(("total_amount"::numeric / 1.19), 2),
    2
  );

ALTER TABLE "tote-bag"."order_items"
ALTER COLUMN "net_unit_price" SET NOT NULL,
ALTER COLUMN "tax_amount" SET NOT NULL;

ALTER TABLE "tote-bag"."orders"
ALTER COLUMN "net_amount" SET NOT NULL,
ALTER COLUMN "tax_total" SET NOT NULL;
