-- AlterTable
ALTER TABLE "personalization_options" ADD COLUMN     "allowed_material_values" TEXT[] DEFAULT ARRAY[]::TEXT[];
