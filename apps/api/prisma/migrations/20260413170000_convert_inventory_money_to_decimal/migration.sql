ALTER TABLE "tote-bag"."suppliers"
  ALTER COLUMN "balance" TYPE DECIMAL(18,2) USING ROUND("balance"::numeric, 2),
  ALTER COLUMN "balance" SET DEFAULT 0;

ALTER TABLE "tote-bag"."purchase_batches"
  ALTER COLUMN "unit_cost" TYPE DECIMAL(18,2) USING ROUND("unit_cost"::numeric, 2),
  ALTER COLUMN "total_cost" TYPE DECIMAL(18,2) USING ROUND("total_cost"::numeric, 2);

ALTER TABLE "tote-bag"."financial_transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
