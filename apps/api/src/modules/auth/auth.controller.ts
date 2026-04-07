import {
  Controller,
  Patch,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Ip,
  Req,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangeDebugRoleDto } from './dto/change-debug-role.dto';
import { Request } from 'express';
import { canUseDebugRole } from '../../common/utils/debug-role.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(registerDto, ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Patch('debug/change-role')
  @HttpCode(HttpStatus.OK)
  changeDebugRole(
    @Req() req: Request & { user?: { id?: string; email?: string | null } },
    @Body() dto: ChangeDebugRoleDto,
  ) {
    if (!canUseDebugRole(req.user?.email, process.env.NODE_ENV)) {
      throw new NotFoundException();
    }

    if (!req.user?.id) {
      throw new UnauthorizedException();
    }

    return this.authService.changeDebugRole(dto.newRole, req.user?.email);
  }
}
