import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Order, Shipment, Profile } from '../../generated/client/client';

interface ShippingAddress {
  address?: string;
  neighborhood?: string;
  city?: string;
  notes?: string;
  additionalInfo?: string;
}

@Injectable()
export class ShippingPdfService {
  generateShippingLabel(
    res: Response,
    order: Order & { profile: Profile | null },
    shipment: Shipment,
  ) {
    const doc = new PDFDocument({
      size: [283.46, 425.2], // 100mm x 150mm approx (A6-ish / typical label)
      margin: 20,
    });

    // Pipe PDF to response
    doc.pipe(res);

    // Header - Logo
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('TOTE BAG', { align: 'center' });
    doc
      .fontSize(8)
      .font('Helvetica')
      .text('Tienda Oficial', { align: 'center' });
    doc.moveDown();

    // Line
    doc.moveTo(20, doc.y).lineTo(263, doc.y).stroke();
    doc.moveDown();

    // SENDER (Bodega)
    doc.fontSize(10).font('Helvetica-Bold').text('REMITENTE:');
    doc.fontSize(8).font('Helvetica').text('Tote Bag Colombia');
    doc.text('Bodega Central - Calle 123 #45-67');
    doc.text('Bogotá D.C., Colombia');
    doc.text('Tel: +57 300 000 0000');
    doc.moveDown();

    // Line
    doc.moveTo(20, doc.y).lineTo(263, doc.y).stroke();
    doc.moveDown();

    // RECIPIENT
    const shippingAddress = order.shippingAddress as unknown as ShippingAddress;
    const recipientName =
      `${order.profile?.firstName || ''} ${order.profile?.lastName || ''}`.trim() ||
      'Cliente';
    const recipientPhone = order.profile?.phone || order.customerPhone || 'N/A';

    doc.fontSize(10).font('Helvetica-Bold').text('DESTINATARIO:');
    doc.fontSize(12).font('Helvetica-Bold').text(recipientName.toUpperCase());
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Dirección: ${shippingAddress?.address || 'N/A'}`);
    doc.text(`Barrio/Apto: ${shippingAddress?.neighborhood || ''}`);
    doc.text(`Ciudad: ${shippingAddress?.city || order.city || 'N/A'}`);
    doc.text(`Teléfono: ${recipientPhone}`);
    doc.moveDown();

    // Line
    doc.moveTo(20, doc.y).lineTo(263, doc.y).stroke();
    doc.moveDown();

    // PACKAGE INFO
    doc.fontSize(8).font('Helvetica-Bold').text(`ORDEN: #${order.orderNumber}`);
    doc.text(`PESO: ${shipment.weight || 0} Kg`);
    doc.text(`DIMENSIONES: ${shipment.dimensions || 'N/A'}`);
    doc.moveDown();

    // NOTES
    const notes = shippingAddress?.notes || shippingAddress?.additionalInfo;
    if (notes) {
      doc.fontSize(8).font('Helvetica-Bold').text('NOTAS DE ENTREGA:');
      doc.fontSize(8).font('Helvetica').text(notes);
      doc.moveDown();
    }

    // FOOTER / Barcode Placeholder
    doc
      .fontSize(7)
      .text('Gracias por tu compra en Tote Bag', { align: 'center' });

    // End document
    doc.end();
  }
}
