import { Role } from '../../generated/client/enums';

export interface RolePermission {
  resource: string;
  action: string;
}

const ALL_PERMISSIONS: readonly RolePermission[] = [
  { resource: 'dashboard', action: 'read' },
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

const MANAGER_PERMISSIONS = ALL_PERMISSIONS.filter(
  (permission) =>
    [
      'dashboard',
      'products',
      'orders',
      'b2b',
      'shipping',
      'personalizations',
    ].includes(permission.resource) ||
    (permission.resource === 'knowledge-posts' && permission.action === 'read'),
);

const CUSTOMER_PERMISSIONS = ALL_PERMISSIONS.filter(
  (permission) =>
    permission.resource === 'products' && permission.action === 'read',
);

const ROLE_PERMISSIONS: Record<Role, readonly RolePermission[]> = {
  [Role.ADMIN]: ALL_PERMISSIONS,
  [Role.MANAGER]: MANAGER_PERMISSIONS,
  [Role.CUSTOMER]: CUSTOMER_PERMISSIONS,
};

export function getPermissionsForRole(role: Role | null | undefined) {
  if (!role) {
    return [];
  }

  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
