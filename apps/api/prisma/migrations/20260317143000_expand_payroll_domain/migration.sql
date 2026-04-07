CREATE TYPE "tote-bag"."PayrollShiftStatus" AS ENUM (
  'RECORDED',
  'BILLED',
  'PAID',
  'CANCELLED'
);

CREATE TYPE "tote-bag"."PayrollWorkerType" AS ENUM (
  'EMPLOYEE',
  'CONTRACTOR',
  'TEMPORARY',
  'OTHER'
);

CREATE TABLE "tote-bag"."payroll_workers" (
  "id" SERIAL NOT NULL,
  "display_name" TEXT NOT NULL,
  "document_number" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "worker_type" "tote-bag"."PayrollWorkerType" NOT NULL DEFAULT 'CONTRACTOR',
  "role_name" TEXT,
  "hourly_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT NOT NULL DEFAULT '',
  "created_by_user_id" TEXT,
  "updated_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_workers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_workers_document_number_key"
ON "tote-bag"."payroll_workers"("document_number");

CREATE INDEX "payroll_workers_is_active_display_name_idx"
ON "tote-bag"."payroll_workers"("is_active", "display_name");

ALTER TABLE "tote-bag"."payroll_shifts"
ADD COLUMN "worker_id" INTEGER,
ADD COLUMN "hourly_rate_applied" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "status" "tote-bag"."PayrollShiftStatus" NOT NULL DEFAULT 'RECORDED',
ADD COLUMN "created_by_user_id" TEXT,
ADD COLUMN "updated_by_user_id" TEXT;

CREATE INDEX "payroll_shifts_worker_id_work_date_idx"
ON "tote-bag"."payroll_shifts"("worker_id", "work_date");

ALTER TABLE "tote-bag"."payroll_shifts"
ADD CONSTRAINT "payroll_shifts_worker_id_fkey"
FOREIGN KEY ("worker_id")
REFERENCES "tote-bag"."payroll_workers"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "tote-bag"."payroll_billing_statements"
ADD COLUMN "worker_id" INTEGER,
ADD COLUMN "statement_number" TEXT,
ADD COLUMN "created_by_user_id" TEXT,
ADD COLUMN "updated_by_user_id" TEXT,
ADD COLUMN "sent_by_user_id" TEXT,
ADD COLUMN "paid_by_user_id" TEXT;

CREATE INDEX "payroll_billing_statements_worker_id_created_at_idx"
ON "tote-bag"."payroll_billing_statements"("worker_id", "created_at");

ALTER TABLE "tote-bag"."payroll_billing_statements"
ADD CONSTRAINT "payroll_billing_statements_worker_id_fkey"
FOREIGN KEY ("worker_id")
REFERENCES "tote-bag"."payroll_workers"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
