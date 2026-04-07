-- CreateEnum
CREATE TYPE "tote-bag"."PqrsType" AS ENUM ('PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA');

-- CreateEnum
CREATE TYPE "tote-bag"."PqrsStatus" AS ENUM ('NUEVO', 'EN_REVISION', 'RESPONDIDO', 'CERRADO');

-- CreateTable
CREATE TABLE "tote-bag"."pqrs_tickets" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "type" "tote-bag"."PqrsType" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "order_number" TEXT,
    "status" "tote-bag"."PqrsStatus" NOT NULL DEFAULT 'NUEVO',
    "admin_response" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pqrs_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pqrs_tickets_status_created_at_idx" ON "tote-bag"."pqrs_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "pqrs_tickets_type_created_at_idx" ON "tote-bag"."pqrs_tickets"("type", "created_at");
