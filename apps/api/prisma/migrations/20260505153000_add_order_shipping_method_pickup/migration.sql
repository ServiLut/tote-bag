DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ShippingMethod'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."ShippingMethod" AS ENUM ('SHIPPING', 'PICKUP');
  END IF;
END $$;

ALTER TABLE "tote-bag"."orders"
  ADD COLUMN IF NOT EXISTS "shipping_method" "tote-bag"."ShippingMethod" NOT NULL DEFAULT 'SHIPPING',
  ADD COLUMN IF NOT EXISTS "shipping_cost" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "tote-bag"."orders"
  DROP CONSTRAINT IF EXISTS "orders_pickup_shipping_cost_check";

ALTER TABLE "tote-bag"."orders"
  ADD CONSTRAINT "orders_pickup_shipping_cost_check"
  CHECK ("shipping_method" <> 'PICKUP' OR "shipping_cost" = 0);
