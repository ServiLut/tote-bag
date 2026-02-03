import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../generated/client/enums';

import { WompiEvent } from './interfaces/wompi-event.interface';

@Injectable()
export class PaymentsService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Genera la firma de integridad requerida por el Widget de Wompi
   * Referencia: https://docs.wompi.co/docs/en-us/widget-web-checkout/
   */
  async generateSignature(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Orden no encontrada');
    }

    const amountInCents = Math.round(order.totalAmount * 100); // Wompi usa centavos
    const currency = 'COP';
    const integritySecret = this.configService.get<string>(
      'WOMPI_INTEGRITY_SECRET',
    );

    if (!integritySecret) {
      throw new BadRequestException('WOMPI_INTEGRITY_SECRET no configurado');
    }

    // Cadena para firmar: Referencia + MontoEnCentavos + Moneda + Secreto
    const signatureString = `${order.id}${amountInCents}${currency}${integritySecret}`;

    // Generar SHA-256
    const signature = createHash('sha256')
      .update(signatureString)
      .digest('hex');

    return {
      reference: order.id,
      amountInCents,
      currency,
      signature,
      publicKey: this.configService.get<string>('WOMPI_PUBLIC_KEY'),
    };
  }

  /**
   * Maneja los eventos enviados por Wompi (Webhooks)
   */
  async handleWompiEvent(event: WompiEvent) {
    // Verificar firma del evento (Opcional pero recomendado para seguridad)
    // Por simplicidad, confiaremos en los datos del evento por ahora,
    // pero en producción se debe validar el checksum del evento.

    const { data } = event;
    const { reference, status } = data.transaction;

    // Mapear estado de Wompi a nuestro OrderStatus
    let newStatus: OrderStatus | null = null;

    switch (status) {
      case 'APPROVED':
        newStatus = OrderStatus.PAGADA;
        break;
      case 'VOIDED':
      case 'DECLINED':
      case 'ERROR':
        newStatus = OrderStatus.CANCELADA;
        break;
      default:
        // PENDING u otros estados intermedios, no hacemos nada
        break;
    }

    if (newStatus) {
      await this.prisma.order.update({
        where: { id: reference },
        data: {
          status: newStatus,
          statusHistory: {
            create: {
              status: newStatus,
            },
          },
        },
      });
    }

    return { success: true };
  }
}
