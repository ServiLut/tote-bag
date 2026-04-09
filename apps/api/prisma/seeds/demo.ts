import { PrismaClient } from '../../src/generated/client/client';
import {
  AttributeType,
  PriceRuleScope,
  ProductStatus,
  PrintType,
} from '../../src/generated/client/enums';

export async function runDemoSeed(prisma: PrismaClient) {
  console.log('Poblando datos demo opcionales...');

  const collection = await prisma.collection.upsert({
    where: { slug: 'tote-bags' },
    update: { name: 'Tote Bags' },
    create: {
      name: 'Tote Bags',
      slug: 'tote-bags',
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: 'tote-bag-clasica' },
    update: {
      name: 'Tote Bag Clasica',
      description: 'Nuestra bolsa de tela mas iconica y resistente.',
      basePrice: 25000,
      minPrice: 18000,
      status: ProductStatus.DISPONIBLE,
      deliveryTime: '3-5 dias',
      material: 'Algodon',
      collectionId: collection.id,
      printType: PrintType.DTF,
    },
    create: {
      name: 'Tote Bag Clasica',
      description: 'Nuestra bolsa de tela mas iconica y resistente.',
      slug: 'tote-bag-clasica',
      basePrice: 25000,
      minPrice: 18000,
      status: ProductStatus.DISPONIBLE,
      deliveryTime: '3-5 dias',
      material: 'Algodon',
      collectionId: collection.id,
      printType: PrintType.DTF,
    },
  });

  const masterAttributes = [
    {
      productId: product.id,
      type: AttributeType.QUALITY,
      value: 'Basica',
      sortOrder: 1,
      priceModifier: 0,
    },
    {
      productId: product.id,
      type: AttributeType.QUALITY,
      value: 'Estandar',
      sortOrder: 2,
      priceModifier: 4000,
    },
    {
      productId: product.id,
      type: AttributeType.QUALITY,
      value: 'Premium',
      sortOrder: 3,
      priceModifier: 9000,
    },
    {
      productId: product.id,
      type: AttributeType.LINE,
      value: 'ECO',
      sortOrder: 1,
      priceModifier: -2000,
    },
    {
      productId: product.id,
      type: AttributeType.LINE,
      value: 'COMERCIAL',
      sortOrder: 2,
      priceModifier: 0,
    },
    {
      productId: product.id,
      type: AttributeType.LINE,
      value: 'PREMIUM',
      sortOrder: 3,
      priceModifier: 12000,
    },
    {
      productId: product.id,
      type: AttributeType.MATERIAL,
      value: 'Lona',
      sortOrder: 1,
      priceModifier: 3000,
    },
    {
      productId: product.id,
      type: AttributeType.MATERIAL,
      value: 'Algodon',
      sortOrder: 2,
      priceModifier: 0,
    },
    {
      productId: product.id,
      type: AttributeType.MATERIAL,
      value: 'Poliester',
      sortOrder: 3,
      priceModifier: -1000,
    },
  ];

  await prisma.productAttribute.deleteMany({
    where: {
      productId: product.id,
      type: AttributeType.SIZE,
    },
  });

  for (const attribute of masterAttributes) {
    await prisma.productAttribute.deleteMany({
      where: {
        productId: product.id,
        type: attribute.type,
        value: attribute.value,
      },
    });

    await prisma.productAttribute.create({
      data: attribute,
    });
  }

  await prisma.pricingRule.deleteMany({
    where: {
      productId: product.id,
      scope: PriceRuleScope.B2B,
    },
  });

  const pricingRules = [
    {
      productId: product.id,
      scope: PriceRuleScope.B2B,
      minQty: 50,
      discountPct: 10,
    },
    {
      productId: product.id,
      scope: PriceRuleScope.B2B,
      minQty: 100,
      discountPct: 20,
    },
    {
      productId: product.id,
      scope: PriceRuleScope.B2B,
      minQty: 500,
      fixedUnitPrice: 15000,
    },
  ];

  for (const rule of pricingRules) {
    await prisma.pricingRule.create({ data: rule });
  }

  console.log('Creando variantes comerciales para el producto base...');

  const demoVariants = [
    {
      sku: 'TOTE-CL-MINI-CRUDO',
      size: 'Mini',
      color: 'Crudo',
      salePrice: 22000,
      minPrice: 18000,
      comparePrice: 25000,
      costPrice: 12000,
      stock: 400,
      imageUrl: '/placeholder.svg',
      isActive: true,
    },
    {
      sku: 'TOTE-CL-STD-CRUDO',
      size: 'Estandar',
      color: 'Crudo',
      salePrice: 25000,
      minPrice: 20000,
      comparePrice: 29000,
      costPrice: 14000,
      stock: 600,
      imageUrl: '/placeholder.svg',
      isActive: true,
    },
  ];

  for (const variant of demoVariants) {
    await prisma.variant.upsert({
      where: { sku: variant.sku },
      update: variant,
      create: {
        productId: product.id,
        ...variant,
      },
    });
  }
}
