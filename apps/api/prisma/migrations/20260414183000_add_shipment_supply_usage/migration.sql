-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SupplyItemType'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."SupplyItemType" AS ENUM (
      'GENERAL',
      'SHIPPING_BAG'
    );
  END IF;
END $$;

-- Mark supplies by operational type without breaking existing free-form
-- categories. Existing supplies remain GENERAL until explicitly classified.
ALTER TABLE "tote-bag"."supply_items"
ADD COLUMN IF NOT EXISTS "supply_type" "tote-bag"."SupplyItemType" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE IF NOT EXISTS "tote-bag"."shipment_supply_usages" (
  "id" TEXT NOT NULL,
  "shipment_id" TEXT NOT NULL,
  "supply_item_id" TEXT NOT NULL,
  "quantity_used" DECIMAL(18,3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "shipment_supply_usages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_supply_usages_quantity_used_positive_check" CHECK ("quantity_used" > 0)
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tote-bag"."shipment_supply_usage_allocations" (
  "id" TEXT NOT NULL,
  "shipment_supply_usage_id" TEXT NOT NULL,
  "purchase_batch_line_id" TEXT NOT NULL,
  "quantity_allocated" DECIMAL(18,3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shipment_supply_usage_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_supply_usage_allocations_quantity_allocated_positive_check" CHECK ("quantity_allocated" > 0)
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supply_items_supply_type_is_active_idx"
ON "tote-bag"."supply_items"("supply_type", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "shipment_supply_usages_shipment_id_idx"
ON "tote-bag"."shipment_supply_usages"("shipment_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "shipment_supply_usages_supply_item_id_idx"
ON "tote-bag"."shipment_supply_usages"("supply_item_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "shipment_supply_usages_shipment_id_supply_item_id_key"
ON "tote-bag"."shipment_supply_usages"("shipment_id", "supply_item_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "shipment_supply_usage_allocations_usage_id_idx"
ON "tote-bag"."shipment_supply_usage_allocations"("shipment_supply_usage_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "shipment_supply_usage_allocations_batch_line_id_idx"
ON "tote-bag"."shipment_supply_usage_allocations"("purchase_batch_line_id");

-- AddForeignKey
ALTER TABLE "tote-bag"."shipment_supply_usages"
ADD CONSTRAINT "shipment_supply_usages_shipment_id_fkey"
FOREIGN KEY ("shipment_id") REFERENCES "tote-bag"."shipments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."shipment_supply_usages"
ADD CONSTRAINT "shipment_supply_usages_supply_item_id_fkey"
FOREIGN KEY ("supply_item_id") REFERENCES "tote-bag"."supply_items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."shipment_supply_usage_allocations"
ADD CONSTRAINT "shipment_supply_usage_allocations_usage_id_fkey"
FOREIGN KEY ("shipment_supply_usage_id") REFERENCES "tote-bag"."shipment_supply_usages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."shipment_supply_usage_allocations"
ADD CONSTRAINT "shipment_supply_usage_allocations_batch_line_id_fkey"
FOREIGN KEY ("purchase_batch_line_id") REFERENCES "tote-bag"."purchase_batch_lines"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
