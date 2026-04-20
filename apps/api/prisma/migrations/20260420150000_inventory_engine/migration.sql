-- Stock fisico/comprometido/disponible y bitacora inmutable de inventario.

ALTER TABLE "tote-bag"."variants"
  ADD COLUMN "stock_committed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reorder_point" INTEGER;

ALTER TABLE "tote-bag"."supply_items"
  ADD COLUMN "stock_committed" DECIMAL(18,3) NOT NULL DEFAULT 0;

CREATE TYPE "tote-bag"."InventoryAdjustmentItemType" AS ENUM (
  'VARIANT',
  'SUPPLY'
);

CREATE TYPE "tote-bag"."InventoryAdjustmentReason" AS ENUM (
  'ENTRADA_MAQUILA',
  'SALIDA_MUESTRA_PUBLICIDAD',
  'SALIDA_AVERIA',
  'AJUSTE_VENTA_EXTERNA'
);

CREATE TYPE "tote-bag"."InventoryMovementReason" AS ENUM (
  'PURCHASE_RECEIPT',
  'SALE_CONSUMPTION',
  'RETURN_TO_STOCK',
  'MANUAL_ADJUSTMENT',
  'STOCK_COMMITMENT',
  'STOCK_COMMITMENT_RELEASE',
  'SHIPMENT_SUPPLY_USAGE'
);

CREATE TABLE "tote-bag"."inventory_adjustments" (
  "id" TEXT NOT NULL,
  "reason" "tote-bag"."InventoryAdjustmentReason" NOT NULL,
  "item_type" "tote-bag"."InventoryAdjustmentItemType" NOT NULL,
  "quantity_delta" DECIMAL(18,3) NOT NULL,
  "notes" TEXT,
  "user_id" TEXT,
  "variant_id" TEXT,
  "supply_item_id" TEXT,
  "purchase_batch_id" TEXT,
  "purchase_batch_line_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tote-bag"."inventory_movements" (
  "id" TEXT NOT NULL,
  "reason" "tote-bag"."InventoryMovementReason" NOT NULL,
  "item_type" "tote-bag"."InventoryAdjustmentItemType" NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "balance_after" DECIMAL(18,3) NOT NULL,
  "user_id" TEXT,
  "variant_id" TEXT,
  "supply_item_id" TEXT,
  "purchase_batch_id" TEXT,
  "purchase_batch_line_id" TEXT,
  "order_id" TEXT,
  "adjustment_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_movements_adjustment_id_key"
  ON "tote-bag"."inventory_movements"("adjustment_id");

CREATE INDEX "inventory_adjustments_reason_created_at_idx"
  ON "tote-bag"."inventory_adjustments"("reason", "created_at");
CREATE INDEX "inventory_adjustments_variant_id_idx"
  ON "tote-bag"."inventory_adjustments"("variant_id");
CREATE INDEX "inventory_adjustments_supply_item_id_idx"
  ON "tote-bag"."inventory_adjustments"("supply_item_id");
CREATE INDEX "inventory_adjustments_purchase_batch_id_idx"
  ON "tote-bag"."inventory_adjustments"("purchase_batch_id");
CREATE INDEX "inventory_adjustments_purchase_batch_line_id_idx"
  ON "tote-bag"."inventory_adjustments"("purchase_batch_line_id");

CREATE INDEX "inventory_movements_created_at_idx"
  ON "tote-bag"."inventory_movements"("created_at");
CREATE INDEX "inventory_movements_reason_idx"
  ON "tote-bag"."inventory_movements"("reason");
CREATE INDEX "inventory_movements_variant_id_idx"
  ON "tote-bag"."inventory_movements"("variant_id");
CREATE INDEX "inventory_movements_supply_item_id_idx"
  ON "tote-bag"."inventory_movements"("supply_item_id");
CREATE INDEX "inventory_movements_purchase_batch_id_idx"
  ON "tote-bag"."inventory_movements"("purchase_batch_id");
CREATE INDEX "inventory_movements_purchase_batch_line_id_idx"
  ON "tote-bag"."inventory_movements"("purchase_batch_line_id");
CREATE INDEX "inventory_movements_order_id_idx"
  ON "tote-bag"."inventory_movements"("order_id");

ALTER TABLE "tote-bag"."inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "tote-bag"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_supply_item_id_fkey"
  FOREIGN KEY ("supply_item_id") REFERENCES "tote-bag"."supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_purchase_batch_id_fkey"
  FOREIGN KEY ("purchase_batch_id") REFERENCES "tote-bag"."purchase_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_purchase_batch_line_id_fkey"
  FOREIGN KEY ("purchase_batch_line_id") REFERENCES "tote-bag"."purchase_batch_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tote-bag"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "tote-bag"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_supply_item_id_fkey"
  FOREIGN KEY ("supply_item_id") REFERENCES "tote-bag"."supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_purchase_batch_id_fkey"
  FOREIGN KEY ("purchase_batch_id") REFERENCES "tote-bag"."purchase_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_purchase_batch_line_id_fkey"
  FOREIGN KEY ("purchase_batch_line_id") REFERENCES "tote-bag"."purchase_batch_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "tote-bag"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tote-bag"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_adjustment_id_fkey"
  FOREIGN KEY ("adjustment_id") REFERENCES "tote-bag"."inventory_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

