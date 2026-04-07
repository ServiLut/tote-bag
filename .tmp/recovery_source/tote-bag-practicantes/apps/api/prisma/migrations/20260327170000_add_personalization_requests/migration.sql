-- CreateEnum
CREATE TYPE "tote-bag"."PersonalizationRequestStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "tote-bag"."personalization_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "line" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "quality" TEXT,
    "config_code" TEXT NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" "tote-bag"."PersonalizationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "design_url" TEXT,
    "personalizations" JSONB NOT NULL,
    "configuration_json" JSONB NOT NULL,
    "pricing_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personalization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personalization_requests_status_created_at_idx" ON "tote-bag"."personalization_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "personalization_requests_user_id_created_at_idx" ON "tote-bag"."personalization_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "personalization_requests_product_id_created_at_idx" ON "tote-bag"."personalization_requests"("product_id", "created_at");

-- AddForeignKey
ALTER TABLE "tote-bag"."personalization_requests" ADD CONSTRAINT "personalization_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "tote-bag"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."personalization_requests" ADD CONSTRAINT "personalization_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "tote-bag"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."personalization_requests" ADD CONSTRAINT "personalization_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tote-bag"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."personalization_requests" ADD CONSTRAINT "personalization_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tote-bag"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tote-bag"."personalization_requests" ADD CONSTRAINT "personalization_requests_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "tote-bag"."variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
