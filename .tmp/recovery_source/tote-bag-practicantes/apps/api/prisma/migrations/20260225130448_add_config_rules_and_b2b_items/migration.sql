/*
  Warnings:

  - You are about to drop the column `pricing_json` on the `b2b_quote_items` table. All the data in the column will be lost.
  - You are about to drop the column `total_price` on the `b2b_quote_items` table. All the data in the column will be lost.
  - You are about to drop the column `unit_price` on the `b2b_quote_items` table. All the data in the column will be lost.
  - You are about to drop the column `variant_id` on the `b2b_quote_items` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `discount_percentage` on the `pricing_rules` table. All the data in the column will be lost.
  - You are about to drop the column `min_quantity` on the `pricing_rules` table. All the data in the column will be lost.
  - The `scope` column on the `pricing_rules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `is_default` on the `product_attributes` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `product_attributes` table. All the data in the column will be lost.
  - Made the column `configuration_json` on table `b2b_quote_items` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ProductLine" AS ENUM ('ECO', 'COMERCIAL', 'PREMIUM', 'CORPORATIVA');

-- CreateEnum
CREATE TYPE "PriceRuleScope" AS ENUM ('B2C', 'B2B');

-- AlterTable
ALTER TABLE "b2b_quote_items" DROP COLUMN "pricing_json",
DROP COLUMN "total_price",
DROP COLUMN "unit_price",
DROP COLUMN "variant_id",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "target_unit_price" DOUBLE PRECISION,
ALTER COLUMN "configuration_json" SET NOT NULL;

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "price",
ADD COLUMN     "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "personalization_options" ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "pricing_rules" DROP COLUMN "discount_percentage",
DROP COLUMN "min_quantity",
ADD COLUMN     "discount_pct" INTEGER,
ADD COLUMN     "fixed_unit_price" DOUBLE PRECISION,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_qty" INTEGER,
ADD COLUMN     "min_qty" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "scope",
ADD COLUMN     "scope" "PriceRuleScope" NOT NULL DEFAULT 'B2C';

-- AlterTable
ALTER TABLE "product_attributes" DROP COLUMN "is_default",
DROP COLUMN "name",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "value" TEXT NOT NULL DEFAULT '';

-- DropEnum
DROP TYPE "PricingScope";

-- CreateTable
CREATE TABLE "personalization_rules" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "personalization_id" TEXT NOT NULL,
    "allowed_size_values" TEXT[],
    "allowed_quality_values" TEXT[],
    "allowed_material_values" TEXT[],
    "extra_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extra_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "personalization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personalization_rules_product_id_idx" ON "personalization_rules"("product_id");

-- CreateIndex
CREATE INDEX "personalization_rules_personalization_id_idx" ON "personalization_rules"("personalization_id");

-- CreateIndex
CREATE INDEX "pricing_rules_product_id_scope_idx" ON "pricing_rules"("product_id", "scope");

-- CreateIndex
CREATE INDEX "product_attributes_product_id_type_idx" ON "product_attributes"("product_id", "type");

-- AddForeignKey
ALTER TABLE "personalization_rules" ADD CONSTRAINT "personalization_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personalization_rules" ADD CONSTRAINT "personalization_rules_personalization_id_fkey" FOREIGN KEY ("personalization_id") REFERENCES "personalization_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
