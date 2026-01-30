import { PrismaClient, ProductStatus, PrintType, OrderStatus } from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (connectionString) {
  console.log('🔗 URL:', connectionString.replace(/:[^:@]+@/, ':****@'));
} else {
  console.error('❌ NO DATABASE_URL FOUND');
}

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

const pool = new pg.Pool({ 
  connectionString: cleanedUrl,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando Seed...');

  // Limpiar BD (Orden importante por claves foráneas)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.b2BQuote.deleteMany();
  await prisma.profile.deleteMany();

  // 0. Crear Perfil Admin
  console.log('👤 Creando Perfil Admin...');
  await prisma.profile.create({
    data: {
      email: 'admin@tote.com',
      userId: 'admin-dev-id', // Placeholder para desarrollo
      firstName: 'Admin',
      lastName: 'ToteBag'
    }
  });

  // 1. Crear Productos
  console.log('🛍️ Creando Productos...');
  
  const product1 = await prisma.product.create({
    data: {
      name: 'Tote Bag Minimalista',
      slug: 'tote-bag-minimalista',
      description: 'Nuestro diseño más vendido. Tela cruda de alta resistencia, ideal para el día a día.',
      basePrice: 45000,
      minPrice: 35000,
      comparePrice: 55000,
      costPrice: 20000,
      status: ProductStatus.DISPONIBLE,
      collection: 'Básicos 2026',
      deliveryTime: '2-3 días hábiles',
      material: 'Lona Costeña 100% Algodón',
      printType: PrintType.SERIGRAFIA,
      tags: ['basico', 'oferta', 'best-seller'],
      images: [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1597484662317-c9313897018e?auto=format&fit=crop&q=80&w=800'
      ],
      variants: {
        create: [
          { sku: 'TB-BASIC-CRUDO', color: 'Crudo', stock: 50, imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363' },
          { sku: 'TB-BASIC-NEGRO', color: 'Negro', stock: 25, imageUrl: 'https://images.unsplash.com/photo-1597484662317-c9313897018e' }
        ]
      }
    }
  });

  const product2 = await prisma.product.create({
    data: {
      name: 'Tote Bag Evento',
      slug: 'tote-bag-evento',
      description: 'Perfecta para congresos y ferias. Personalización full color.',
      basePrice: 38000,
      minPrice: 30000,
      costPrice: 18000,
      status: ProductStatus.BAJO_PEDIDO,
      collection: 'Corporativo',
      deliveryTime: '5-7 días hábiles',
      material: 'Lienzo',
      printType: PrintType.DTF,
      tags: ['b2b', 'evento'],
      images: [
        'https://images.unsplash.com/photo-1622560480605-d83c85265c91?auto=format&fit=crop&q=80&w=800'
      ],
      variants: {
        create: [
          { sku: 'TB-EVENT-BLANCO', color: 'Blanco', stock: 0, imageUrl: 'https://images.unsplash.com/photo-1622560480605-d83c85265c91' }
        ]
      }
    }
  });

  // 2. Crear Órdenes (Algunas de hoy para el dashboard)
  console.log('📦 Creando Órdenes...');
  
  const today = new Date();
  
  // Orden 1: De hoy (cuenta para producción diaria)
  await prisma.order.create({
    data: {
      customerEmail: 'juan.perez@gmail.com',
      customerPhone: '3001234567',
      shippingAddress: 'Calle 123 #45-67',
      city: 'Bogotá',
      totalAmount: 90000,
      status: OrderStatus.PAGADA,
      createdAt: today, // Hoy
      items: {
        create: [
          { 
            productId: product1.id, 
            sku: 'TB-BASIC-CRUDO', 
            quantity: 2, 
            price: 45000 
          }
        ]
      }
    }
  });

  // Orden 2: De ayer (histórico)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.order.create({
    data: {
      customerEmail: 'maria.gomez@hotmail.com',
      customerPhone: '3109876543',
      shippingAddress: 'Cra 10 #20-30',
      city: 'Medellín',
      totalAmount: 38000,
      status: OrderStatus.ENVIADA,
      createdAt: yesterday,
      items: {
        create: [
          { 
            productId: product2.id, 
            sku: 'TB-EVENT-BLANCO', 
            quantity: 1, 
            price: 38000 
          }
        ]
      }
    }
  });

  // 3. Crear Cotizaciones B2B
  console.log('💼 Creando Cotizaciones B2B...');
  await prisma.b2BQuote.createMany({
    data: [
      {
        businessName: 'Tech Solutions SAS',
        quantity: 100,
        city: 'Cali',
        contactPhone: '3205551234',
        qrType: 'WEB',
        package: 'Pro',
        status: 'PENDIENTE',
        logoUrl: 'https://example.com/logo.pdf'
      },
      {
        businessName: 'Festival de Cine',
        quantity: 500,
        city: 'Cartagena',
        contactPhone: '3151112222',
        qrType: 'INSTAGRAM',
        package: 'Evento',
        status: 'DISEÑO_APROBADO',
        logoUrl: 'https://example.com/festival.ai'
      }
    ]
  });

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
