import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import {
  Order,
  OrderItem,
  Profile,
  Product,
} from '../../generated/client/client';
import {
  decimalToNumber,
  DecimalInput,
} from '../../common/utils/sales-tax.util';

export interface ExtendedOrderItem extends OrderItem {
  product?: Product;
}

export interface ExtendedOrder extends Order {
  profile: Profile | null;
  items: ExtendedOrderItem[];
}

@Injectable()
export class ReceiptPdfService {
  generateSaleReceipt(res: Response, order: ExtendedOrder) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    // Pipe PDF to response
    doc.pipe(res);

    // Header - Company Info
    doc.fontSize(20).font('Helvetica-Bold').text('TOTE BAG', { align: 'left' });
    doc.fontSize(10).font('Helvetica').text('NIT: 900.123.456-7');
    doc.text('Dirección: Calle 123 #45-67, Bogotá D.C.');
    doc.text('Contacto: +57 300 000 0000 | info@totebag.com');
    doc.moveDown();

    // Receipt Title & Number
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('RECIBO DE VENTA', { align: 'right' });
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`N°: #${order.orderNumber}`, { align: 'right' });
    doc.text(`Fecha: ${order.createdAt.toLocaleDateString()}`, {
      align: 'right',
    });
    doc.moveDown();

    // Client Info
    doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL CLIENTE:');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Nombre: ${order.profile?.firstName || ''} ${order.profile?.lastName || ''}`,
      );
    doc.text(`Cédula/NIT: ${order.profile?.id || 'N/A'}`); // Using ID as placeholder for Cédula
    doc.text(`Email: ${order.customerEmail}`);
    doc.text(`Teléfono: ${order.customerPhone}`);
    doc.text(`Dirección: ${order.city}, Colombia`);
    doc.moveDown();

    // Table Header
    const tableTop = 320;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Producto', 50, tableTop);
    doc.text('Cantidad', 250, tableTop, { width: 50, align: 'center' });
    doc.text('P. Unitario', 320, tableTop, { width: 80, align: 'right' });
    doc.text('Subtotal', 420, tableTop, { width: 100, align: 'right' });

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Table Content
    let currentY = tableTop + 25;
    order.items.forEach((item) => {
      doc.fontSize(9).font('Helvetica');
      const productName = item.product?.name || item.sku;
      doc.text(productName, 50, currentY, { width: 180 });
      doc.text(item.quantity.toString(), 250, currentY, {
        width: 50,
        align: 'center',
      });
      doc.text(this.formatCurrency(item.unitPrice), 320, currentY, {
        width: 80,
        align: 'right',
      });
      doc.text(this.formatCurrency(item.totalPrice), 420, currentY, {
        width: 100,
        align: 'right',
      });

      currentY += 20;
    });

    // Totals
    const totalsY = currentY + 30;
    doc.moveTo(300, totalsY).lineTo(550, totalsY).stroke();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('SUBTOTAL:', 320, totalsY + 10, { width: 80, align: 'right' });
    doc
      .font('Helvetica')
      .text(this.formatCurrency(order.totalAmount), 420, totalsY + 10, {
        width: 100,
        align: 'right',
      });

    doc
      .font('Helvetica-Bold')
      .text('TOTAL:', 320, totalsY + 25, { width: 80, align: 'right' });
    doc
      .fontSize(12)
      .text(this.formatCurrency(order.totalAmount), 420, totalsY + 25, {
        width: 100,
        align: 'right',
      });

    // Payment Info
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('INFORMACIÓN DE PAGO:', 50, totalsY + 60);
    doc.fontSize(9).font('Helvetica').text(`Estado: ${order.status}`);
    doc.text(`Origen: ${order.source}`);
    doc.text(`Método: Transferencia / Pasarela Web`);
    doc.moveDown();

    // Footer
    doc
      .fontSize(8)
      .text(
        'Este documento es un soporte de venta y no una factura fiscal.',
        50,
        750,
        { align: 'center' },
      );
    doc.text('Gracias por elegir Tote Bag - www.totebag.com', {
      align: 'center',
    });

    // End document
    doc.end();
  }

  private formatCurrency(amount: DecimalInput) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(decimalToNumber(amount));
  }
}
