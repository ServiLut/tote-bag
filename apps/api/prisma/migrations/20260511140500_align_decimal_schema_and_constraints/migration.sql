-- DropForeignKey
ALTER TABLE "purchase_batches" DROP CONSTRAINT "purchase_batches_product_id_fkey";

-- AlterTable
ALTER TABLE "app_settings"
ALTER COLUMN "value" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "b2b_quote_items"
ALTER COLUMN "target_unit_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "external_unit_cost" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "agreed_unit_price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "knowledge_posts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "manager_approvals" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "order_items"
ALTER COLUMN "total_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "total_amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "payroll_billing_statements"
ALTER COLUMN "total_amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "payroll_shifts"
ALTER COLUMN "total_amount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "hourly_rate_applied" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "payroll_workers"
ALTER COLUMN "hourly_rate" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "personalization_options"
ALTER COLUMN "base_price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "personalization_requests"
ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total_price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "personalization_rules"
ALTER COLUMN "extra_price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "pricing_rules"
ALTER COLUMN "fixed_unit_price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "product_attributes"
ALTER COLUMN "price_modifier" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products"
ALTER COLUMN "base_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "min_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "compare_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "cost_price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "shipments"
ALTER COLUMN "weight" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "variants"
ALTER COLUMN "sale_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "min_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "compare_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "cost_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total_cost" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "wizard_options"
ALTER COLUMN "base_price_modifier" SET DATA TYPE DECIMAL(10,2);

-- RenameForeignKey
ALTER TABLE "shipment_supply_usage_allocations"
RENAME CONSTRAINT "shipment_supply_usage_allocations_batch_line_id_fkey"
TO "shipment_supply_usage_allocations_purchase_batch_line_id_fkey";

-- RenameForeignKey
ALTER TABLE "shipment_supply_usage_allocations"
RENAME CONSTRAINT "shipment_supply_usage_allocations_usage_id_fkey"
TO "shipment_supply_usage_allocations_shipment_supply_usage_id_fkey";

-- AddForeignKey
ALTER TABLE "purchase_batches"
ADD CONSTRAINT "purchase_batches_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "manager_approvals_approved_by_created_at_idx"
RENAME TO "manager_approvals_approved_by_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "manager_approvals_scope_idx"
RENAME TO "manager_approvals_resource_action_entity_entity_id_idx";

-- RenameIndex
ALTER INDEX "shipment_supply_usage_allocations_batch_line_id_idx"
RENAME TO "shipment_supply_usage_allocations_purchase_batch_line_id_idx";

-- RenameIndex
ALTER INDEX "shipment_supply_usage_allocations_usage_id_idx"
RENAME TO "shipment_supply_usage_allocations_shipment_supply_usage_id_idx";
