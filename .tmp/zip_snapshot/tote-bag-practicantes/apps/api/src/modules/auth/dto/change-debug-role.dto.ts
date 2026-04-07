import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '../../../generated/client/enums';

export class ChangeDebugRoleDto {
  @IsEnum(Role, { message: 'El rol solicitado no es valido' })
  @IsNotEmpty({ message: 'El nuevo rol es obligatorio' })
  newRole: Role;
}
