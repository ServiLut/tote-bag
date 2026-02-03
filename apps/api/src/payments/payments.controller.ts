import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { WompiEvent } from './interfaces/wompi-event.interface';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('wompi/signature/:orderId')
  getSignature(@Param('orderId') orderId: string) {
    return this.paymentsService.generateSignature(orderId);
  }

  @Post('wompi/webhook')
  handleWebhook(@Body() event: WompiEvent) {
    return this.paymentsService.handleWompiEvent(event);
  }
}
