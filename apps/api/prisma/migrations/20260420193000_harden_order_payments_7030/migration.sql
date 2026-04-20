UPDATE "tote-bag"."order_payments" AS op
SET "proof_url" = COALESCE(
  NULLIF(BTRIM(op."proof_url"), ''),
  NULLIF(BTRIM(o."payment_receipt_url"), ''),
  CONCAT('https://tote-bag.local/legacy-support/order-payments/', op."id")
)
FROM "tote-bag"."orders" AS o
WHERE op."order_id" = o."id"
  AND (op."proof_url" IS NULL OR BTRIM(op."proof_url") = '');

INSERT INTO "tote-bag"."order_payments" (
  "id",
  "order_id",
  "amount",
  "payment_date",
  "proof_url",
  "notes",
  "created_at"
)
SELECT
  CONCAT('legacy-order-payment-', o."id"),
  o."id",
  o."amount_paid",
  o."created_at",
  COALESCE(
    NULLIF(BTRIM(o."payment_receipt_url"), ''),
    CONCAT('https://tote-bag.local/legacy-support/orders/', o."id")
  ),
  'Abono historico reconstruido desde amount_paid',
  CURRENT_TIMESTAMP
FROM "tote-bag"."orders" AS o
WHERE o."amount_paid" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "tote-bag"."order_payments" AS op
    WHERE op."order_id" = o."id"
      AND op."deleted_at" IS NULL
  );

ALTER TABLE "tote-bag"."order_payments"
ALTER COLUMN "proof_url" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_payments_amount_positive_chk'
  ) THEN
    ALTER TABLE "tote-bag"."order_payments"
    ADD CONSTRAINT "order_payments_amount_positive_chk"
    CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_payments_proof_url_present_chk'
  ) THEN
    ALTER TABLE "tote-bag"."order_payments"
    ADD CONSTRAINT "order_payments_proof_url_present_chk"
    CHECK (BTRIM("proof_url") <> '');
  END IF;
END $$;
