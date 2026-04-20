import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Body,
  Param,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { PaymentsService, PaymentSupportEntityType } from './payments.service';
import { WompiEvent } from './interfaces/wompi-event.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesService } from '../roles/roles.service';
import { Role } from '../../generated/client/client';

interface RequestWithUser {
  user?: { id: string };
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('signature/:orderId')
  generateSignature(@Param('orderId') orderId: string) {
    return this.paymentsService.generateSignature(orderId);
  }

  @Get('wompi/signature/:orderId')
  generateWompiSignature(@Param('orderId') orderId: string) {
    return this.paymentsService.generateSignature(orderId);
  }

  @Post('webhook/wompi')
  handleWompiEvent(
    @Body() event: WompiEvent,
    @Headers('x-event-checksum') checksumHeader?: string,
  ) {
    return this.paymentsService.handleWompiEvent(event, checksumHeader);
  }

  @Post('wompi/webhook')
  handleWompiWebhook(
    @Body() event: WompiEvent,
    @Headers('x-event-checksum') checksumHeader?: string,
  ) {
    return this.paymentsService.handleWompiEvent(event, checksumHeader);
  }

  @Post('upload-receipt/:entityType/:entityId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(
    @Param('entityType')
    entityType: PaymentSupportEntityType,
    @Param('entityId') entityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!file) {
      throw new BadRequestException('Debes seleccionar un archivo para subir.');
    }

    await this.ensureUploadPermission(req.user.id, entityType);

    return this.paymentsService.uploadPaymentReceipt(
      entityId,
      entityType,
      file,
    );
  }

  @Get('supports/:entityType/:entityId/signed-url')
  async getSupportSignedUrl(
    @Param('entityType')
    entityType: PaymentSupportEntityType,
    @Param('entityId') entityId: string,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    await this.ensureSupportReadPermission(req.user.id, entityType);
    return this.paymentsService.getSupportSignedUrl(entityId, entityType);
  }

  private async ensureUploadPermission(
    userId: string,
    entityType: PaymentSupportEntityType,
  ) {
    if (entityType === 'order' || entityType === 'order-payment') {
      const hasPermission = await this.rolesService.hasPermission(
        userId,
        'orders',
        'update',
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'No tienes permisos para actualizar comprobantes de pedidos.',
        );
      }

      return;
    }

    if (entityType === 'b2b') {
      const hasPermission = await this.rolesService.hasPermission(
        userId,
        'b2b',
        'manage',
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'No tienes permisos para actualizar comprobantes B2B.',
        );
      }

      return;
    }

    if (entityType === 'purchase-invoice') {
      const { effectiveRole } =
        await this.rolesService.getEffectiveRole(userId);

      if (effectiveRole !== Role.ADMIN) {
        throw new ForbiddenException(
          'Solo los usuarios ADMIN pueden subir comprobantes de facturas de compra.',
        );
      }

      return;
    }

    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);

    if (effectiveRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Solo los usuarios ADMIN pueden subir comprobantes de lotes.',
      );
    }
  }

  private async ensureSupportReadPermission(
    userId: string,
    entityType: PaymentSupportEntityType,
  ) {
    const { effectiveRole } = await this.rolesService.getEffectiveRole(userId);

    if (effectiveRole === Role.MANAGER) {
      return;
    }

    return this.ensureUploadPermission(userId, entityType);
  }
}
