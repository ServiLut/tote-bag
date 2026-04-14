-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PurchaseBatchItemType'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."PurchaseBatchItemType" AS ENUM (
      'VARIANT',
      'SUPPLY',
      'TOOL',
      'OTHER'
    );
  END IF;
END $$;

-- PurchaseBatch is now the reception header. Legacy direct product fields remain
-- for existing FIFO Variant flows, but product_id cannot be required for mixed
-- operational supply receptions.
ALTER TABLE "tote-bag"."purchase_batches"
ALTER COLUMN "product_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "tote-bag"."supply_items" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "category" TEXT NOT NULL,
  "unit_of_measure" TEXT NOT NULL,
  "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "stock" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "min_stock" DECIMAL(18,3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supply_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tote-bag"."purchase_batch_lines" (
  "id" TEXT NOT NULL,
  "purchase_batch_id" TEXT NOT NULL,
  "item_type" "tote-bag"."PurchaseBatchItemType" NOT NULL,
  "variant_id" TEXT,
  "supply_item_id" TEXT,
  "item_name" TEXT,
  "description" TEXT,
  "quantity" DECIMAL(18,3) NOT NULL,
  "quantity_remaining" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "unit_of_measure" TEXT NOT NULL,
  "unit_cost" DECIMAL(18,2) NOT NULL,
  "line_total" DECIMAL(18,2) NOT NULL,
  "status" "tote-bag"."BatchStatus" NOT NULL DEFAULT 'IN_STOCK',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "purchase_batch_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_batch_lines_quantity_nonnegative_check" CHECK ("quantity" >= 0),
  CONSTRAINT "purchase_batch_lines_unit_cost_nonnegative_check" CHECK ("unit_cost" >= 0),
  CONSTRAINT "purchase_batch_lines_line_total_nonnegative_check" CHECK ("line_total" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "supply_items_sku_key"
ON "tote-bag"."supply_items"("sku");

-- CreateIndex
CREATE INDEX "supply_items_category_is_active_idx"
ON "tote-bag"."supply_items"("category", "is_active");

-- CreateIndex
CREATE INDEX "supply_items_name_idx"
ON "tote-bag"."supply_items"("name");

-- CreateIndex
CREATE INDEX "purchase_batch_lines_purchase_batch_id_idx"
ON "tote-bag"."purchase_batch_lines"("purchase_batch_id");

-- CreateIndex
CREATE INDEX "purchase_batch_lines_item_type_idx"
ON "tote-bag"."purchase_batch_lines"("item_type");

-- CreateIndex
CREATE INDEX "purchase_batch_lines_variant_id_idx"
ON "tote-bag"."purchase_batch_lines"("variant_id");

-- CreateIndex
CREATE INDEX "purchase_batch_lines_supply_item_id_idx"
ON "tote-bag"."purchase_batch_lines"("supply_item_id");

-- AddForeignKey
ALTER TABLE "tote-bag"."purchase_batch_lines"
ADD CONSTRAINT "purchase_batch_lines_purchase_batch_id_fkey"
FOREIGN KEY ("purchase_batch_id") REFERENCES "tote-bag"."purchase_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."purchase_batch_lines"
ADD CONSTRAINT "purchase_batch_lines_variant_id_fkey"
FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."purchase_batch_lines"
ADD CONSTRAINT "purchase_batch_lines_supply_item_id_fkey"
FOREIGN KEY ("supply_item_id") REFERENCES "tote-bag"."supply_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every historical PurchaseBatch gets one compatible line.
-- Existing batches with variant_id become VARIANT lines. Older batches without
-- variant_id are preserved as OTHER descriptive lines so they do not imply
-- sellable Variant inventory.
INSERT INTO "tote-bag"."purchase_batch_lines" (
  "id",
  "purchase_batch_id",
  "item_type",
  "variant_id",
  "item_name",
  "description",
  "quantity",
  "quantity_remaining",
  "unit_of_measure",
  "unit_cost",
  "line_total",
  "status",
  "notes",
  "created_at",
  "updated_at"
)
SELECT
  CONCAT('legacy-', pb."id"),
  pb."id",
  CASE
    WHEN pb."variant_id" IS NOT NULL THEN 'VARIANT'::"tote-bag"."PurchaseBatchItemType"
    ELSE 'OTHER'::"tote-bag"."PurchaseBatchItemType"
  END,
  pb."variant_id",
  CASE
    WHEN pb."variant_id" IS NULL THEN COALESCE(p."name", 'Lote historico')
    ELSE NULL
  END,
  CASE
    WHEN pb."variant_id" IS NULL THEN 'Linea historica generada desde PurchaseBatch sin variant_id'
    ELSE NULL
  END,
  pb."quantity_received"::DECIMAL(18,3),
  pb."quantity_remaining"::DECIMAL(18,3),
  'und',
  pb."unit_cost",
  pb."total_cost",
  pb."status",
  'Generada automaticamente por migracion de compatibilidad',
  pb."created_at",
  pb."updated_at"
FROM "tote-bag"."purchase_batches" pb
LEFT JOIN "tote-bag"."products" p ON p."id" = pb."product_id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "tote-bag"."purchase_batch_lines" pbl
  WHERE pbl."id" = CONCAT('legacy-', pb."id")
);
