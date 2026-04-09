import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import { PurchaseInvoiceStatus } from '../../generated/client/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { CreatePurchasePaymentDto } from './dto/create-purchase-payment.dto';
import { UpdatePurchaseInvoiceDto } from './dto/update-purchase-invoice.dto';
import { UpdatePurchasePaymentDto } from './dto/update-purchase-payment.dto';

const purchaseInvoiceInclude = {
  supplier: true,
  purchaseBatch: {
    include: {
      product: true,
      variant: true,
    },
  },
  payments: {
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.PurchaseInvoiceInclude;

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async createPurchaseInvoice(data: CreatePurchaseInvoiceDto) {
    const totalAmount = this.parsePositiveDecimal(
      data.totalAmount,
      'El total de la factura debe ser mayor a cero',
    );

    const issueDate = this.parseDateOrThrow(
      data.issueDate,
      'La fecha de emision es invalida',
    );

    if (!data.supplierId && !data.purchaseBatchId) {
      throw new BadRequestException(
        'Debes indicar supplierId o purchaseBatchId para registrar la factura',
      );
    }

    let resolvedSupplierId = data.supplierId ?? null;
    let purchaseBatchId = data.purchaseBatchId ?? null;

    const [supplier, purchaseBatch] = await Promise.all([
      resolvedSupplierId
        ? this.prisma.supplier.findUnique({
            where: { id: resolvedSupplierId },
            select: { id: true },
          })
        : Promise.resolve(null),
      purchaseBatchId
        ? this.prisma.purchaseBatch.findUnique({
            where: { id: purchaseBatchId },
            select: { id: true, supplierId: true },
          })
        : Promise.resolve(null),
    ]);

    if (resolvedSupplierId && !supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    if (purchaseBatchId && !purchaseBatch) {
      throw new NotFoundException('Lote de compra no encontrado');
    }

    if (purchaseBatch) {
      if (
        resolvedSupplierId &&
        purchaseBatch.supplierId !== resolvedSupplierId
      ) {
        throw new BadRequestException(
          'El lote indicado no pertenece al proveedor seleccionado',
        );
      }

      resolvedSupplierId ??= purchaseBatch.supplierId;
      purchaseBatchId = purchaseBatch.id;
    }

    return this.prisma.purchaseInvoice.create({
      data: {
        totalAmount,
        paidAmount: new Prisma.Decimal(0),
        balanceDue: totalAmount,
        status: PurchaseInvoiceStatus.PENDING,
        issueDate,
        supplierId: resolvedSupplierId,
        purchaseBatchId,
      },
      include: purchaseInvoiceInclude,
    });
  }

  async findAllPurchaseInvoices() {
    return this.prisma.purchaseInvoice.findMany({
      include: purchaseInvoiceInclude,
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updatePurchaseInvoice(
    invoiceId: string,
    data: UpdatePurchaseInvoiceDto,
  ) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        supplierId: true,
        purchaseBatchId: true,
        issueDate: true,
        totalAmount: true,
        paidAmount: true,
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura de compra no encontrada');
    }

    const nextTotalAmount = data.totalAmount
      ? this.parsePositiveDecimal(
          data.totalAmount,
          'El total de la factura debe ser mayor a cero',
        )
      : new Prisma.Decimal(invoice.totalAmount);

    const nextIssueDate = data.issueDate
      ? this.parseDateOrThrow(data.issueDate, 'La fecha de emision es invalida')
      : invoice.issueDate;

    let nextSupplierId = data.supplierId ?? invoice.supplierId;

    const [supplier, purchaseBatch] = await Promise.all([
      nextSupplierId
        ? this.prisma.supplier.findUnique({
            where: { id: nextSupplierId },
            select: { id: true },
          })
        : Promise.resolve(null),
      invoice.purchaseBatchId
        ? this.prisma.purchaseBatch.findUnique({
            where: { id: invoice.purchaseBatchId },
            select: { id: true, supplierId: true },
          })
        : Promise.resolve(null),
    ]);

    if (nextSupplierId && !supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    if (invoice.purchaseBatchId && !purchaseBatch) {
      throw new NotFoundException('Lote de compra no encontrado');
    }

    if (purchaseBatch) {
      if (nextSupplierId && purchaseBatch.supplierId !== nextSupplierId) {
        throw new BadRequestException(
          'El lote asociado no pertenece al proveedor seleccionado',
        );
      }

      nextSupplierId ??= purchaseBatch.supplierId;
    }

    const paidAmount = new Prisma.Decimal(invoice.paidAmount);

    if (nextTotalAmount.lessThan(paidAmount)) {
      throw new BadRequestException(
        'El total de la factura no puede ser menor al valor ya abonado',
      );
    }

    const nextBalanceDue = nextTotalAmount.minus(paidAmount);
    const nextStatus = this.resolveInvoiceStatus(
      invoice._count.payments,
      nextBalanceDue,
    );

    return this.prisma.purchaseInvoice.update({
      where: { id: invoiceId },
      data: {
        supplierId: nextSupplierId,
        totalAmount: nextTotalAmount,
        issueDate: nextIssueDate,
        balanceDue: nextBalanceDue,
        status: nextStatus,
      },
      include: purchaseInvoiceInclude,
    });
  }

  async registerPurchaseInvoicePayment(
    invoiceId: string,
    data: CreatePurchasePaymentDto,
  ) {
    const amount = this.parsePositiveDecimal(
      data.amount,
      'El monto del pago debe ser mayor a cero',
    );
    const paymentDate = this.parseDateOrThrow(
      data.paymentDate,
      'La fecha del pago es invalida',
    );
    const proofUrl = data.proofUrl?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true,
          balanceDue: true,
          _count: {
            select: {
              payments: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Factura de compra no encontrada');
      }

      const currentPaidAmount = new Prisma.Decimal(invoice.paidAmount);
      const currentBalanceDue = new Prisma.Decimal(invoice.balanceDue);
      const totalAmount = new Prisma.Decimal(invoice.totalAmount);

      if (amount.greaterThan(currentBalanceDue)) {
        throw new BadRequestException(
          'El pago no puede superar el saldo pendiente de la factura',
        );
      }

      const nextPaidAmount = currentPaidAmount.plus(amount);
      const nextBalanceDue = totalAmount.minus(nextPaidAmount);
      const nextPaymentsCount = invoice._count.payments + 1;

      if (nextPaidAmount.greaterThan(totalAmount)) {
        throw new BadRequestException(
          'El total pagado no puede superar el total de la factura',
        );
      }

      if (nextBalanceDue.lessThan(0)) {
        throw new BadRequestException(
          'El saldo pendiente no puede quedar negativo',
        );
      }

      const nextStatus = this.resolveInvoiceStatus(
        nextPaymentsCount,
        nextBalanceDue,
      );

      const payment = await tx.purchasePayment.create({
        data: {
          invoiceId,
          amount,
          paymentDate,
          proofUrl,
        },
      });

      const updatedInvoice = await tx.purchaseInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: nextPaidAmount,
          balanceDue: nextBalanceDue,
          status: nextStatus,
        },
        include: purchaseInvoiceInclude,
      });

      return {
        payment,
        invoice: updatedInvoice,
      };
    });
  }

  async updatePurchaseInvoicePayment(
    invoiceId: string,
    paymentId: string,
    data: UpdatePurchasePaymentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.purchasePayment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          invoiceId: true,
          amount: true,
          paymentDate: true,
          proofUrl: true,
        },
      });

      if (!payment || payment.invoiceId !== invoiceId) {
        throw new NotFoundException('Abono de factura no encontrado');
      }

      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          totalAmount: true,
          _count: {
            select: {
              payments: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Factura de compra no encontrada');
      }

      const paymentsSummary = await tx.purchasePayment.aggregate({
        where: {
          invoiceId,
          NOT: {
            id: paymentId,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const nextAmount = data.amount
        ? this.parsePositiveDecimal(
            data.amount,
            'El monto del pago debe ser mayor a cero',
          )
        : new Prisma.Decimal(payment.amount);
      const nextPaymentDate = data.paymentDate
        ? this.parseDateOrThrow(
            data.paymentDate,
            'La fecha del pago es invalida',
          )
        : payment.paymentDate;
      const nextProofUrl =
        data.proofUrl !== undefined
          ? data.proofUrl.trim() || null
          : payment.proofUrl;

      const paidWithoutCurrent = new Prisma.Decimal(
        paymentsSummary._sum.amount ?? 0,
      );
      const totalAmount = new Prisma.Decimal(invoice.totalAmount);
      const nextPaidAmount = paidWithoutCurrent.plus(nextAmount);
      const nextBalanceDue = totalAmount.minus(nextPaidAmount);

      if (nextPaidAmount.greaterThan(totalAmount)) {
        throw new BadRequestException(
          'El total pagado no puede superar el total de la factura',
        );
      }

      if (nextBalanceDue.lessThan(0)) {
        throw new BadRequestException(
          'El saldo pendiente no puede quedar negativo',
        );
      }

      const nextStatus = this.resolveInvoiceStatus(
        invoice._count.payments,
        nextBalanceDue,
      );

      const updatedPayment = await tx.purchasePayment.update({
        where: { id: paymentId },
        data: {
          amount: nextAmount,
          paymentDate: nextPaymentDate,
          proofUrl: nextProofUrl,
        },
      });

      const updatedInvoice = await tx.purchaseInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: nextPaidAmount,
          balanceDue: nextBalanceDue,
          status: nextStatus,
        },
        include: purchaseInvoiceInclude,
      });

      return {
        payment: updatedPayment,
        invoice: updatedInvoice,
      };
    });
  }

  async deletePurchaseInvoice(invoiceId: string) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura de compra no encontrada');
    }

    if (invoice._count.payments > 0) {
      throw new BadRequestException(
        'No puedes eliminar una factura que ya tiene pagos registrados',
      );
    }

    return this.prisma.purchaseInvoice.delete({
      where: { id: invoiceId },
    });
  }

  private parsePositiveDecimal(value: string, errorMessage: string) {
    let parsedValue: Prisma.Decimal;

    try {
      parsedValue = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('Monto decimal invalido');
    }

    if (!parsedValue.isFinite() || parsedValue.lessThanOrEqualTo(0)) {
      throw new BadRequestException(errorMessage);
    }

    return parsedValue;
  }

  private parseDateOrThrow(value: string, errorMessage: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(errorMessage);
    }

    return parsed;
  }

  private resolveInvoiceStatus(
    paymentsCount: number,
    balanceDue: Prisma.Decimal,
  ) {
    if (balanceDue.isZero()) {
      return PurchaseInvoiceStatus.PAID;
    }

    if (paymentsCount === 0) {
      return PurchaseInvoiceStatus.PENDING;
    }

    return PurchaseInvoiceStatus.PARTIAL;
  }
}
