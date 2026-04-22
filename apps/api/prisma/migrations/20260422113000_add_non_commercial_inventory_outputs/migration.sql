DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NonCommercialInventoryOutputReason'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."NonCommercialInventoryOutputReason" AS ENUM (
      'GIFT',
      'SAMPLE',
      'INTERNAL_TEST',
      'OPERATIONAL_USE',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NonCommercialInventoryOutputStatus'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."NonCommercialInventoryOutputStatus" AS ENUM (
      'COMPLETED'
    );
  END IF;
END $$;

ALTER TYPE "tote-bag"."InventoryMovementReason" ADD VALUE IF NOT EXISTS 'NON_COMMERCIAL_OUTPUT';

CREATE TABLE IF NOT EXISTS "tote-bag"."non_commercial_inventory_outputs" (
  "id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" "tote-bag"."NonCommercialInventoryOutputReason" NOT NULL,
  "notes" TEXT,
  "support_url" TEXT,
  "status" "tote-bag"."NonCommercialInventoryOutputStatus" NOT NULL DEFAULT 'COMPLETED',
  "stock_before" INTEGER NOT NULL,
  "stock_after" INTEGER NOT NULL,
  "metadata" JSONB,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "non_commercial_inventory_outputs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "non_commercial_inventory_outputs_created_at_idx"
ON "tote-bag"."non_commercial_inventory_outputs"("created_at");

CREATE INDEX IF NOT EXISTS "non_commercial_inventory_outputs_reason_created_at_idx"
ON "tote-bag"."non_commercial_inventory_outputs"("reason", "created_at");

CREATE INDEX IF NOT EXISTS "non_commercial_inventory_outputs_status_created_at_idx"
ON "tote-bag"."non_commercial_inventory_outputs"("status", "created_at");

CREATE INDEX IF NOT EXISTS "non_commercial_inventory_outputs_user_id_idx"
ON "tote-bag"."non_commercial_inventory_outputs"("user_id");

CREATE INDEX IF NOT EXISTS "non_commercial_inventory_outputs_variant_id_idx"
ON "tote-bag"."non_commercial_inventory_outputs"("variant_id");

ALTER TABLE "tote-bag"."non_commercial_inventory_outputs"
  ADD CONSTRAINT "non_commercial_inventory_outputs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "tote-bag"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tote-bag"."non_commercial_inventory_outputs"
  ADD CONSTRAINT "non_commercial_inventory_outputs_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
