import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateCustomerDto {
  @IsEmail({}, { message: 'El correo electronico no es valido.' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsUUID('4')
  @IsOptional()
  municipalityId?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
