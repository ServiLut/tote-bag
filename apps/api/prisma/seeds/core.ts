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
        ),
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
