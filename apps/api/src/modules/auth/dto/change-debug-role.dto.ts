import { IsIn, IsNotEmpty } from 'class-validator';

const ROLES = ['ADMIN', 'MANAGER', 'CUSTOMER'] as const;

export class ChangeDebugRoleDto {
  @IsIn(ROLES, { message: 'El rol solicitado no es valido' })
  @IsNotEmpty({ message: 'El nuevo rol es obligatorio' })
  newRole: (typeof ROLES)[number];
}
