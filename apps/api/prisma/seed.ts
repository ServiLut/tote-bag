import { PrismaClient } from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AttributeType, PriceRuleScope, ProductStatus, PrintType, ProductLine } from '../src/generated/client/enums';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Clean SSL params from URL to let pg.Pool config handle it
let cleanedUrl = connectionString || '';
try {
  const urlObj = new URL(cleanedUrl);
  urlObj.searchParams.delete('sslmode');
  urlObj.searchParams.delete('sslrootcert');
  urlObj.searchParams.delete('sslcert');
  urlObj.searchParams.delete('sslkey');
  cleanedUrl = urlObj.toString();
} catch (e) {
  // ignore
}

const pool = new pg.Pool({ connectionString: cleanedUrl, ssl: false });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando Seed de Datos...');

  // 1. Departamentos y Municipios
  console.log('🇨🇴 Poblando Departamentos y Municipios...');
  const jsonPath = path.join(__dirname, '../departamentos-municipios.json');
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const locations = JSON.parse(rawData);

    const departmentsMap = new Map();
    locations.forEach((loc: any) => {
      if (!departmentsMap.has(loc.cod_dpto)) {
        departmentsMap.set(loc.cod_dpto, {
          name: loc.dpto,
          code: loc.cod_dpto
        });
      }
    });

    await prisma.department.createMany({
      data: Array.from(departmentsMap.values()),
      skipDuplicates: true,
    });

    const createdDepartments = await prisma.department.findMany();
    const depCodeToId = new Map(createdDepartments.map(d => [d.code, d.id]));

    const municipalitiesData = locations.map((loc: any) => {
      const depId = depCodeToId.get(loc.cod_dpto);
      if (!depId) return null;
      
      return {
        name: loc.nom_mpio,
        code: loc.cod_mpio,
        departmentId: depId
      };
    }).filter((m: any) => m !== null);

    await prisma.municipality.createMany({
      data: municipalitiesData,
      skipDuplicates: true,
    });
    console.log(`✅ Departamentos y Municipios procesados.`);
  }

  // 2. Colección
  console.log('📦 Creando Colección...');
  const collection = await prisma.collection.upsert({
    where: { slug: 'tote-bags' },
    update: {},
    create: {
      name: 'Tote Bags',
      slug: 'tote-bags',
    },
  });

  // 3. Producto de Prueba
  console.log('🛍️ Creando Producto Base...');
  const product = await prisma.product.upsert({
    where: { slug: 'tote-bag-clasica' },
    update: {},
    create: {
      name: 'Tote Bag Clásica',
      description: 'Nuestra bolsa de tela más icónica y resistente.',
      slug: 'tote-bag-clasica',
      basePrice: 25000,
      minPrice: 18000,
      status: ProductStatus.DISPONIBLE,
      deliveryTime: '3-5 días',
      material: 'Algodón',
      collectionId: collection.id,
      printType: PrintType.DTF,
    },
  });

  // 4. Atributos Maestros
  console.log('✨ Creando Atributos Maestros (Marca Dual)...');
  const masterAttributes = [
    // Tamaños
    { productId: product.id, type: AttributeType.SIZE, value: 'Standard', sortOrder: 1, priceModifier: 0 },
    { productId: product.id, type: AttributeType.SIZE, value: 'Mini', sortOrder: 2, priceModifier: -3000 },
    { productId: product.id, type: AttributeType.SIZE, value: 'XL', sortOrder: 3, priceModifier: 5000 },
    { productId: product.id, type: AttributeType.SIZE, value: 'Tote', sortOrder: 4, priceModifier: 2000 },

    // Calidades
    { productId: product.id, type: AttributeType.QUALITY, value: 'Básica', sortOrder: 1, priceModifier: 0 },
    { productId: product.id, type: AttributeType.QUALITY, value: 'Estándar', sortOrder: 2, priceModifier: 4000 },
    { productId: product.id, type: AttributeType.QUALITY, value: 'Premium', sortOrder: 3, priceModifier: 9000 },

    // Líneas
    { productId: product.id, type: AttributeType.LINE, value: 'ECO', sortOrder: 1, priceModifier: -2000 },
    { productId: product.id, type: AttributeType.LINE, value: 'COMERCIAL', sortOrder: 2, priceModifier: 0 },
    { productId: product.id, type: AttributeType.LINE, value: 'PREMIUM', sortOrder: 3, priceModifier: 12000 },
    { productId: product.id, type: AttributeType.LINE, value: 'CORPORATIVA', sortOrder: 4, priceModifier: 5000 },

    // Materiales
    { productId: product.id, type: AttributeType.MATERIAL, value: 'Lona', sortOrder: 1, priceModifier: 3000 },
    { productId: product.id, type: AttributeType.MATERIAL, value: 'Algodón', sortOrder: 2, priceModifier: 0 },
    { productId: product.id, type: AttributeType.MATERIAL, value: 'Poliéster', sortOrder: 3, priceModifier: -1000 },
  ];

  for (const attr of masterAttributes) {
    await prisma.productAttribute.deleteMany({
      where: { productId: product.id, type: attr.type, value: attr.value }
    });
    await prisma.productAttribute.create({ data: attr });
  }

  // 5. Reglas de Precio (B2B/B2C)
  console.log('💰 Creando Reglas de Precio...');
  const pricingRules = [
    { productId: product.id, scope: PriceRuleScope.B2B, minQty: 50, discountPct: 10 },
    { productId: product.id, scope: PriceRuleScope.B2B, minQty: 100, discountPct: 20 },
    { productId: product.id, scope: PriceRuleScope.B2B, minQty: 500, fixedUnitPrice: 15000 },
  ];

  for (const rule of pricingRules) {
    await prisma.pricingRule.create({ data: rule });
  }

  console.log('✅ Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
