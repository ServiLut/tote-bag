CREATE TYPE "tote-bag"."PayrollStatementStatus" AS ENUM (
  'PENDIENTE',
  'ENVIADA',
  'PAGADA'
);

CREATE TABLE "tote-bag"."payroll_billing_statements" (
  "id" SERIAL NOT NULL,
  "collaborator" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "total_amount" DOUBLE PRECISION NOT NULL,
  "status" "tote-bag"."PayrollStatementStatus" NOT NULL DEFAULT 'PENDIENTE',
  "payment_transaction_id" TEXT,
  "sent_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_billing_statements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tote-bag"."payroll_shifts" (
  "id" SERIAL NOT NULL,
  "collaborator" TEXT NOT NULL,
  "work_date" TIMESTAMP(3) NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "total_amount" DOUBLE PRECISION NOT NULL,
  "entry_photo_url" TEXT,
  "exit_photo_url" TEXT,
  "billing_statement_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_billing_statements_status_created_at_idx"
ON "tote-bag"."payroll_billing_statements"("status", "created_at");

CREATE INDEX "payroll_shifts_collaborator_work_date_idx"
ON "tote-bag"."payroll_shifts"("collaborator", "work_date");

CREATE INDEX "payroll_shifts_billing_statement_id_idx"
ON "tote-bag"."payroll_shifts"("billing_statement_id");

ALTER TABLE "tote-bag"."payroll_shifts"
ADD CONSTRAINT "payroll_shifts_billing_statement_id_fkey"
FOREIGN KEY ("billing_statement_id")
REFERENCES "tote-bag"."payroll_billing_statements"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
