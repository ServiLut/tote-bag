import 'dotenv/config';
import { 
  PrismaClient, 
  Role, 
  TransactionType, 
  TransactionCategory, 
  TransactionStatus, 
  BatchStatus, 
  PriceRuleScope, 
  ProductStatus, 
  PrintType,
  PurchaseBatch,
  Product,
  Collection
} from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Configuración de conexión
let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;

try {
  if (connectionString) {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete('sslmode');
    urlObj.searchParams.delete('sslrootcert');
    urlObj.searchParams.delete('sslcert');
    urlObj.searchParams.delete('sslkey');
    if (!urlObj.searchParams.has('schema')) {
      urlObj.searchParams.set('schema', 'tote-bag');
    }
    urlObj.searchParams.set('options', '-c search_path=tote-bag');
    connectionString = urlObj.toString();
  }
} catch (e) {
  console.error('Error parsing DATABASE_URL', e);
}

const pool = new pg.Pool({
  connectionString,
  ssl: false,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🚀 Iniciando siembra de datos de prueba para módulos de administración...');

  // 1. Limpieza de tablas (Orden inverso para integridad referencial)
  // Usamos bloques try-catch individuales para que el script no se detenga si una tabla no existe aún
  console.log('🧹 Intentando limpiar tablas existentes...');
  const tables = [
    'financialTransaction',
    'opexCategory',
    'purchaseBatch',
    'supplier',
    'pricingRule',
    'product',
    'collection'
  ];

  for (const table of tables) {
    try {
      await (prisma as any)[table].deleteMany();
    } catch (e) {
      console.log(`ℹ️ Nota: No se pudo limpiar la tabla ${table} (posiblemente no existe aún).`);
    }
  }

  // 2. Creación de Usuario Base (ADMIN) con UPSERT
  console.log('👤 Configurando usuario administrador...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tote-bag.com' },
    update: { role: Role.ADMIN, isActive: true },
    create: {
      id: 'auth0|admin-test-id',
      email: 'admin@tote-bag.com',
      role: Role.ADMIN,
      isActive: true,
      profile: {
        create: {
          email: 'admin@tote-bag.com',
          firstName: 'Admin',
          lastName: 'Sistema',
        }
      }
    }
  });

  // 3. Creación de Colección y Productos
  console.log('📦 Creando catálogo base...');
  const collection: Collection = await prisma.collection.create({
    data: {
      name: 'Básicos de Lona',
      slug: 'basicos-de-lona-' + Date.now(),
    }
  });

  const product1: Product = await prisma.product.create({
    data: {
      name: 'Tote Bag Clásica',
      description: 'Bolso de lona resistente para uso diario.',
      basePrice: 35000,
      minPrice: 28000,
      costPrice: 15000,
      slug: 'tote-bag-clasica-' + Date.now(),
      collectionId: collection.id,
      deliveryTime: '3-5 días',
      status: ProductStatus.DISPONIBLE,
      printType: PrintType.SERIGRAFIA,
    }
  });

  const product2: Product = await prisma.product.create({
    data: {
      name: 'Tote Bag Premium Eco',
      description: 'Lona orgánica con acabados de lujo.',
      basePrice: 55000,
      minPrice: 45000,
      costPrice: 25000,
      slug: 'tote-bag-premium-eco-' + Date.now(),
      collectionId: collection.id,
      deliveryTime: '5-7 días',
      status: ProductStatus.DISPONIBLE,
      printType: PrintType.DTF,
    }
  });

  // 4. Proveedores
  console.log('🏭 Creando proveedores...');
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'Distribuidora de Lonas Bogotá',
      nit: '900123456-1',
      contact: 'Carlos Rodríguez',
      email: 'ventas@lonasbogota.com',
      phone: '3101234567',
      address: 'Calle 10 # 20-30, Bogotá',
    }
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: 'Hilos y Acabados Medellín',
      nit: '890987654-2',
      contact: 'Marta Lucía Gómez',
      email: 'marta@hilosmedellin.co',
      phone: '3009876543',
      address: 'Carrera 50 # 40-10, Medellín',
    }
  });

  const supplier3 = await prisma.supplier.create({
    data: {
      name: 'Cremalleras Cali S.A.S',
      nit: '800555444-3',
      contact: 'Juan Felipe Soto',
      email: 'contacto@cremalleriscali.com',
      phone: '3155554444',
      address: 'Avenida 6N # 15-20, Cali',
    }
  });

  // 5. Lotes de Compra
  console.log('🚛 Generando lotes de compra...');
  const batches: PurchaseBatch[] = [];
  const now = new Date();

  const batchData = [
    { prod: product1.id, supp: supplier1.id, qty: 100, cost: 8000, days: 25, status: BatchStatus.IN_STOCK },
    { prod: product2.id, supp: supplier1.id, qty: 50, cost: 15000, days: 15, status: BatchStatus.IN_STOCK },
    { prod: product1.id, supp: supplier2.id, qty: 200, cost: 7500, days: 30, status: BatchStatus.DEPLETED },
    { prod: product2.id, supp: supplier3.id, qty: 30, cost: 14000, days: 2, status: BatchStatus.IN_STOCK },
    { prod: product1.id, supp: supplier1.id, qty: 150, cost: 7800, days: 5, status: BatchStatus.IN_STOCK },
  ];

  for (const b of batchData) {
    batches.push(await prisma.purchaseBatch.create({
      data: {
        productId: b.prod,
        supplierId: b.supp,
        quantityReceived: b.qty,
        quantityRemaining: b.status === BatchStatus.DEPLETED ? 0 : b.qty,
        unitCost: b.cost,
        totalCost: b.qty * b.cost,
        status: b.status,
        createdAt: new Date(now.getTime() - b.days * 24 * 60 * 60 * 1000),
      }
    }));
  }

  // 6. Categorías Opex
  console.log('📊 Configurando categorías OPEX...');
  const opexCategories = [
    { name: 'Arriendo Taller', desc: 'Pago mensual del local de producción' },
    { name: 'Publicidad Meta', desc: 'Inversión en Facebook e Instagram Ads' },
    { name: 'Servicios Públicos', desc: 'Energía, Agua e Internet' }
  ];

  const createdOpex: any = {};
  for (const cat of opexCategories) {
    createdOpex[cat.name] = await prisma.opexCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, description: cat.desc }
    });
  }

  // 7. Transacciones
  console.log('💰 Generando transacciones financieras...');
  
  // Egresos por lotes
  for (const batch of batches) {
    await prisma.financialTransaction.create({
      data: {
        type: TransactionType.EXPENSE,
        category: TransactionCategory.PURCHASE,
        amount: batch.totalCost,
        description: `Pago a proveedor por lote de ${batch.quantityReceived} unidades`,
        status: TransactionStatus.COMPLETED,
        userId: adminUser.id,
        purchaseBatchId: batch.id,
        supplierId: batch.supplierId,
        createdAt: batch.createdAt,
      }
    });
  }

  // Gastos fijos
  const opexTrans = [
    { cat: 'Arriendo Taller', amount: 1200000, desc: 'Mensualidad Marzo', days: 0 },
    { cat: 'Publicidad Meta', amount: 450000, desc: 'Campaña Lanzamiento', days: 10 },
    { cat: 'Servicios Públicos', amount: 185000, desc: 'Pago Energía y Acueducto', days: 8 },
  ];

  for (const ot of opexTrans) {
    await prisma.financialTransaction.create({
      data: {
        type: TransactionType.EXPENSE,
        category: TransactionCategory.OPEX,
        amount: ot.amount,
        description: ot.desc,
        status: TransactionStatus.COMPLETED,
        userId: adminUser.id,
        opexCategoryId: createdOpex[ot.cat].id,
        createdAt: new Date(now.getTime() - ot.days * 24 * 60 * 60 * 1000),
      }
    });
  }

  // Ingresos
  const incomes = [
    { amount: 350000, desc: 'Venta Directa Feria Local', days: 3 },
    { amount: 1250000, desc: 'Pedido B2B - Hotel Campestre', days: 6 },
    { amount: 890000, desc: 'Ventas E-commerce Semana 1', days: 9 },
    { amount: 2100000, desc: 'Anticipo Pedido Corporativo', days: 12 },
  ];

  for (const inc of incomes) {
    await prisma.financialTransaction.create({
      data: {
        type: TransactionType.INCOME,
        category: TransactionCategory.SALE,
        amount: inc.amount,
        description: inc.desc,
        status: TransactionStatus.COMPLETED,
        userId: adminUser.id,
        createdAt: new Date(now.getTime() - inc.days * 24 * 60 * 60 * 1000),
      }
    });
  }

  // 8. Reglas de Precio
  console.log('📈 Creando reglas de precio...');
  await prisma.pricingRule.create({
    data: {
      productId: product2.id,
      fixedUnitPrice: 65000,
      scope: PriceRuleScope.B2C,
      minQty: 1,
      isActive: true,
    }
  });

  await prisma.pricingRule.create({
    data: {
      productId: product1.id,
      discountPct: 15,
      scope: PriceRuleScope.B2B,
      minQty: 50,
      isActive: true,
    }
  });

  console.log('✅ Siembra de datos completada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la siembra de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
