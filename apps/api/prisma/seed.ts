import { PrismaClient } from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AttributeType, PricingScope, ProductStatus, PrintType } from '../src/generated/client/enums';

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
  console.log('🌱 Generando Seed...');

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
    console.log(`✅ Municipios procesados.`);
  }

  // 2. Colección
  const collection = await prisma.collection.upsert({
    where: { slug: 'tote-bags' },
    update: {},
    create: { name: 'Tote Bags', slug: 'tote-bags' },
  });

  // 3. Personalización Global
  const personalizations = [
    { name: 'Bordado Frontal', code: 'BORD_FRONT', basePrice: 12000 },
    { name: 'Estampado DTF', code: 'STAMP_DTF', basePrice: 8000 },
  ];

  for (const p of personalizations) {
    await prisma.personalizationOption.upsert({ where: { code: p.code }, update: p, create: p });
  }

  // 4. Producto Base
  const product = await prisma.product.upsert({
    where: { slug: 'tote-bag-clasica' },
    update: { basePrice: 25000, minPrice: 18000 },
    create: {
      name: 'Tote Bag Clásica',
      description: 'Nuestra tote bag más versátil.',
      slug: 'tote-bag-clasica',
      basePrice: 25000,
      minPrice: 18000,
      status: ProductStatus.DISPONIBLE,
      deliveryTime: '3-5 días',
      material: 'Lona',
      collectionId: collection.id,
      printType: PrintType.DTF,
    },
  });

  // 5. Atributos
  const attrs = [
    { productId: product.id, type: AttributeType.SIZE, name: 'Estándar', priceModifier: 0, isDefault: true },
    { productId: product.id, type: AttributeType.SIZE, name: 'Grande', priceModifier: 5000, isDefault: false },
    { productId: product.id, type: AttributeType.QUALITY, name: 'Económica', priceModifier: 0, isDefault: true },
    { productId: product.id, type: AttributeType.QUALITY, name: 'Premium', priceModifier: 7000, isDefault: false },
    { productId: product.id, type: AttributeType.LINE, name: 'BASICA', priceModifier: 0, isDefault: true },
    { productId: product.id, type: AttributeType.MATERIAL, name: 'Lona', priceModifier: 0, isDefault: true },
  ];

  await prisma.productAttribute.deleteMany({ where: { productId: product.id } });
  for (const a of attrs) {
    await prisma.productAttribute.create({ data: a });
  }

  console.log('✅ Seed completado.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
