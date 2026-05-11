import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../../src/generated/client/client';

type LocationRow = {
  dpto: string;
  cod_dpto: string;
  nom_mpio: string;
  cod_mpio: string;
};

export async function runCoreSeed(prisma: PrismaClient) {
  console.log('Poblando datos base...');

  await seedDepartmentsAndMunicipalities(prisma);
  await seedGlobalPersonalizationOptions(prisma);
  await seedRolesAndPermissions(prisma);
  await seedWizardOptions(prisma);
}

async function seedWizardOptions(prisma: PrismaClient) {
  console.log('Procesando opciones del wizard...');

  const wizardOptions = [
    // LINE
    { category: 'LINE', code: 'ECO', name: 'Línea Eco', description: 'Materiales sostenibles y amigables con el medio ambiente.', basePriceModifier: -2000, sortOrder: 1 },
    { category: 'LINE', code: 'COMERCIAL', name: 'Línea Comercial', description: 'Nuestra opción más versátil para todo tipo de uso.', basePriceModifier: 0, sortOrder: 2 },
    { category: 'LINE', code: 'PREMIUM', name: 'Línea Premium', description: 'Acabados de alta calidad para un producto superior.', basePriceModifier: 5000, sortOrder: 3 },
    { category: 'LINE', code: 'CORPORATIVA', name: 'Línea Corporativa', description: 'Diseñada para eventos y necesidades empresariales.', basePriceModifier: 3000, sortOrder: 4 },

    // DIMENSION
    // Compatibility only: dimensions remain selectable metadata, not commercial price modifiers.
    { category: 'DIMENSION', code: 'STD', name: 'Estándar', description: '35x40 cm', basePriceModifier: 0, sortOrder: 1 },
    { category: 'DIMENSION', code: 'MINI', name: 'Pequeña', description: '20x25 cm', basePriceModifier: 0, sortOrder: 2 },
    { category: 'DIMENSION', code: 'XL', name: 'Extra Grande', description: '45x50 cm', basePriceModifier: 0, sortOrder: 3 },

    // MATERIAL
    { category: 'MATERIAL', code: 'LONA', name: 'Lona', description: 'Resistente y duradera.', basePriceModifier: 3000, sortOrder: 1 },
    { category: 'MATERIAL', code: 'ALGODON', name: 'Algodón', description: 'Suave y natural.', basePriceModifier: 0, sortOrder: 2 },
    { category: 'MATERIAL', code: 'POLIESTER', name: 'Poliéster', description: 'Liviano y versátil.', basePriceModifier: -1000, sortOrder: 3 },

    // TECHNIQUE
    { category: 'TECHNIQUE', code: 'SERIGRAFIA', name: 'Serigrafía', description: 'Ideal para grandes volúmenes.', basePriceModifier: 0, sortOrder: 1, allowedMaterialValues: ['Lona', 'Algodón'] },
    { category: 'TECHNIQUE', code: 'DTF', name: 'DTF', description: 'Impresión digital a todo color.', basePriceModifier: 2000, sortOrder: 2, allowedMaterialValues: ['Lona', 'Algodón', 'Poliéster'] },
    { category: 'TECHNIQUE', code: 'BORDADO', name: 'Bordado', description: 'Elegancia y durabilidad.', basePriceModifier: 5000, sortOrder: 3, allowedMaterialValues: ['Lona', 'Algodón'] },
    
    // OTHERS (categorized as TECHNIQUE for the wizard logic)
    { category: 'TECHNIQUE', code: 'ZIPPER', name: 'Cierre', description: 'Cierre de cremallera superior.', basePriceModifier: 3000, sortOrder: 4 },
    { category: 'TECHNIQUE', code: 'BUTTON', name: 'Botón', description: 'Broche magnético o de presión.', basePriceModifier: 1500, sortOrder: 5 },
  ];

  for (const option of wizardOptions) {
    await prisma.wizardOption.upsert({
      where: { code: option.code },
      update: {
        category: option.category as any,
        name: option.name,
        description: option.description,
        basePriceModifier: option.basePriceModifier,
        sortOrder: option.sortOrder,
        allowedMaterialValues: option.allowedMaterialValues || [],
      },
      create: {
        category: option.category as any,
        code: option.code,
        name: option.name,
        description: option.description,
        basePriceModifier: option.basePriceModifier,
        sortOrder: option.sortOrder,
        allowedMaterialValues: option.allowedMaterialValues || [],
      },
    });
  }
}

async function seedDepartmentsAndMunicipalities(prisma: PrismaClient) {
  console.log('Procesando departamentos y municipios...');

  const jsonPath = path.join(__dirname, '../../departamentos-municipios.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('No se encontro el archivo de departamentos y municipios. Se omite.');
    return;
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const locations = JSON.parse(rawData) as LocationRow[];

  const departmentsMap = new Map<string, { name: string; code: string }>();

  locations.forEach((location) => {
    if (!departmentsMap.has(location.cod_dpto)) {
      departmentsMap.set(location.cod_dpto, {
        name: location.dpto,
        code: location.cod_dpto,
      });
    }
  });

  await prisma.department.createMany({
    data: Array.from(departmentsMap.values()),
    skipDuplicates: true,
  });

  const createdDepartments = await prisma.department.findMany({
    select: { id: true, code: true },
  });
  const departmentCodeToId = new Map(
    createdDepartments.map((department) => [department.code, department.id]),
  );

  const municipalities = locations
    .map((location) => {
      const departmentId = departmentCodeToId.get(location.cod_dpto);
      if (!departmentId) {
        return null;
      }

      return {
        name: location.nom_mpio,
        code: location.cod_mpio,
        departmentId,
      };
    })
    .filter((municipality): municipality is NonNullable<typeof municipality> =>
      municipality !== null,
    );

  await prisma.municipality.createMany({
    data: municipalities,
    skipDuplicates: true,
  });
}

async function seedGlobalPersonalizationOptions(prisma: PrismaClient) {
  console.log('Procesando opciones globales de personalizacion...');

  const personalizationOptions = [
    { code: 'STAMP', name: 'Estampado', basePrice: 8000 },
    { code: 'EMBROIDERY', name: 'Bordado', basePrice: 12000 },
    { code: 'ZIPPER', name: 'Cierre / Cremallera', basePrice: 5000 },
    { code: 'BUTTONS', name: 'Botones', basePrice: 3000 },
  ];

  for (const option of personalizationOptions) {
    await prisma.personalizationOption.upsert({
      where: { code: option.code },
      update: {
        name: option.name,
        basePrice: option.basePrice,
      },
      create: option,
    });
  }
}

async function seedRolesAndPermissions(prisma: PrismaClient) {
  console.log('Procesando roles y permisos...');

  const permissions = [
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'read' },
    { resource: 'products', action: 'update' },
    { resource: 'products', action: 'delete' },
    { resource: 'shipping', action: 'create' },
    { resource: 'shipping', action: 'read' },
    { resource: 'shipping', action: 'update' },
    { resource: 'shipping', action: 'delete' },
    { resource: 'orders', action: 'create' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
    { resource: 'orders', action: 'cancel' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'update' },
    { resource: 'users', action: 'delete' },
    { resource: 'analytics', action: 'view' },
    { resource: 'audit', action: 'read' },
    { resource: 'b2b', action: 'manage' },
    { resource: 'personalizations', action: 'manage' },
    { resource: 'knowledge-posts', action: 'create' },
    { resource: 'knowledge-posts', action: 'read' },
    { resource: 'knowledge-posts', action: 'update' },
    { resource: 'knowledge-posts', action: 'delete' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: {},
      create: permission,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const roles = [
    { name: 'admin', description: 'Administrador de tienda' },
    { name: 'manager', description: 'Gestor de inventario y ordenes' },
    { name: 'customer', description: 'Cliente regular' },
  ];

  for (const roleInput of roles) {
    const role = await prisma.roleModel.upsert({
      where: { name: roleInput.name },
      update: { description: roleInput.description },
      create: roleInput,
    });

    let permissionsToAssign = allPermissions.filter(() => false);

    if (roleInput.name === 'admin') {
      permissionsToAssign = allPermissions.filter(
        (permission) => permission.resource !== 'audit',
      );
    } else if (roleInput.name === 'manager') {
      permissionsToAssign = allPermissions.filter((permission) =>
        ['products', 'orders', 'b2b', 'shipping', 'personalizations'].includes(
          permission.resource,
        ) ||
        (permission.resource === 'knowledge-posts' &&
          permission.action === 'read'),
      );
    } else if (roleInput.name === 'customer') {
      permissionsToAssign = allPermissions.filter(
        (permission) =>
          (permission.resource === 'products' && permission.action === 'read') ||
          (permission.resource === 'orders' &&
            (permission.action === 'read' || permission.action === 'create')),
      );
    }

    for (const permission of permissionsToAssign) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}
