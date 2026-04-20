ALTER TABLE "tote-bag"."audit_logs"
ADD COLUMN IF NOT EXISTS "new_data" JSONB;

ALTER TABLE "tote-bag"."orders"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."order_payments"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."b2b_quotes"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."product_attributes"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."personalization_options"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."personalization_rules"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."pricing_rules"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."wizard_options"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."supply_items"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."purchase_batches"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."purchase_invoices"
ADD COLUMN IF NOT EXISTS "support_url" TEXT,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "tote-bag"."purchase_payments"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ManagerApprovalStatus'
      AND n.nspname = 'tote-bag'
  ) THEN
    CREATE TYPE "tote-bag"."ManagerApprovalStatus" AS ENUM (
      'APPROVED',
      'USED',
      'EXPIRED',
      'REVOKED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tote-bag"."manager_approvals" (
  "id" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT,
  "status" "tote-bag"."ManagerApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  "reason" TEXT,
  "metadata" JSONB,
  "requested_by_user_id" TEXT,
  "approved_by_user_id" TEXT NOT NULL,
  "used_by_user_id" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "manager_approvals_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'manager_approvals_requested_by_user_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."manager_approvals"
    ADD CONSTRAINT "manager_approvals_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "tote-bag"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'manager_approvals_approved_by_user_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."manager_approvals"
    ADD CONSTRAINT "manager_approvals_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "tote-bag"."users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'manager_approvals_used_by_user_id_fkey'
  ) THEN
    ALTER TABLE "tote-bag"."manager_approvals"
    ADD CONSTRAINT "manager_approvals_used_by_user_id_fkey"
    FOREIGN KEY ("used_by_user_id") REFERENCES "tote-bag"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "orders_deleted_at_idx"
ON "tote-bag"."orders"("deleted_at");

CREATE INDEX IF NOT EXISTS "order_payments_deleted_at_idx"
ON "tote-bag"."order_payments"("deleted_at");

CREATE INDEX IF NOT EXISTS "b2b_quotes_deleted_at_idx"
ON "tote-bag"."b2b_quotes"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_batches_deleted_at_idx"
ON "tote-bag"."purchase_batches"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_invoices_deleted_at_idx"
ON "tote-bag"."purchase_invoices"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_payments_deleted_at_idx"
ON "tote-bag"."purchase_payments"("deleted_at");

CREATE INDEX IF NOT EXISTS "supply_items_deleted_at_idx"
ON "tote-bag"."supply_items"("deleted_at");

CREATE INDEX IF NOT EXISTS "pricing_rules_deleted_at_idx"
ON "tote-bag"."pricing_rules"("deleted_at");

CREATE INDEX IF NOT EXISTS "wizard_options_deleted_at_idx"
ON "tote-bag"."wizard_options"("deleted_at");

CREATE INDEX IF NOT EXISTS "manager_approvals_scope_idx"
ON "tote-bag"."manager_approvals"("resource", "action", "entity", "entity_id");

CREATE INDEX IF NOT EXISTS "manager_approvals_approved_by_created_at_idx"
ON "tote-bag"."manager_approvals"("approved_by_user_id", "created_at");

CREATE INDEX IF NOT EXISTS "manager_approvals_used_at_expires_at_idx"
ON "tote-bag"."manager_approvals"("used_at", "expires_at");
