import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client';
import { OrderStatus, ShipmentStatus } from '../generated/client/enums';

dotenv.config();

function normalizeConnectionString(connectionString?: string) {
  if (!connectionString) {
    throw new Error('DATABASE_URL not found');
  }

  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('sslrootcert');
    url.searchParams.delete('sslcert');
    url.searchParams.delete('sslkey');
    return url.toString();
  } catch {
    return connectionString;
  }
}

function resolveShipmentStatus(orderStatus: string) {
  switch (orderStatus) {
    case OrderStatus.ENVIADA:
      return ShipmentStatus.SHIPPED;
    case OrderStatus.ENTREGADA:
      return ShipmentStatus.DELIVERED;
    case OrderStatus.CANCELADA:
      return ShipmentStatus.CANCELLED;
    case OrderStatus.RETURNED_TO_STOCK:
      return ShipmentStatus.RETURNED;
    default:
      return ShipmentStatus.PENDING;
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const connectionString = normalizeConnectionString(process.env.DATABASE_URL);

  const pool = new pg.Pool({
    connectionString,
    ssl: false,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const ordersWithoutShipment = await prisma.order.findMany({
      where: {
        shipment: null,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        carrier: true,
        trackingNumber: true,
        shippingAddress: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const orders = ordersWithoutShipment.filter((order) => {
      const shippingAddress =
        order.shippingAddress && typeof order.shippingAddress === 'object'
          ? (order.shippingAddress as Record<string, unknown>)
          : {};

      const providerIdFromAddress =
        typeof shippingAddress.shippingProviderId === 'string'
          ? shippingAddress.shippingProviderId.trim()
          : '';

      const providerNameFromAddress =
        typeof shippingAddress.shippingProviderName === 'string'
          ? shippingAddress.shippingProviderName.trim()
          : '';

      return Boolean(
        order.carrier || providerIdFromAddress || providerNameFromAddress,
      );
    });

    if (orders.length === 0) {
      console.log('No missing shipments found.');
      return;
    }

    console.log(
      `${isDryRun ? 'Found' : 'Processing'} ${orders.length} orders without shipment.`,
    );

    for (const order of orders) {
      const shippingAddress =
        order.shippingAddress && typeof order.shippingAddress === 'object'
          ? (order.shippingAddress as Record<string, unknown>)
          : {};

      const providerIdFromAddress =
        typeof shippingAddress.shippingProviderId === 'string'
          ? shippingAddress.shippingProviderId
          : null;

      const providerNameFromAddress =
        typeof shippingAddress.shippingProviderName === 'string'
          ? shippingAddress.shippingProviderName
          : null;

      const carrierName = order.carrier || providerNameFromAddress || null;

      let providerId = providerIdFromAddress;

      if (!providerId && carrierName) {
        const provider = await prisma.shippingProvider.findFirst({
          where: {
            name: {
              equals: carrierName,
              mode: 'insensitive',
            },
          },
          select: { id: true },
        });

        providerId = provider?.id || null;
      }

      console.log(
        `#${order.orderNumber} -> status=${order.status}, providerId=${providerId || 'null'}, carrier=${carrierName || 'null'}`,
      );

      if (isDryRun) {
        continue;
      }

      await prisma.shipment.create({
        data: {
          orderId: order.id,
          providerId,
          trackingNumber: order.trackingNumber || null,
          status: resolveShipmentStatus(order.status),
          shippedAt:
            order.status === OrderStatus.ENVIADA ||
            order.status === OrderStatus.ENTREGADA
              ? new Date()
              : null,
          deliveredAt:
            order.status === OrderStatus.ENTREGADA ? new Date() : null,
        },
      });
    }

    if (!isDryRun) {
      console.log('Shipment backfill completed successfully.');
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error('Shipment backfill failed:', error);
  process.exit(1);
});
