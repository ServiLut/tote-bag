import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { Order, Shipment, Profile } from '../../generated/client/client';

interface ShippingAddress {
  address?: string;
  neighborhood?: string;
  city?: string;
  notes?: string;
  additionalInfo?: string;
}

const SENDER_LINES = [
  'Tote Bag Colombia',
  'Bodega Central',
  'Bogota D.C., Colombia',
  'Tel: +57 300 000 0000',
];

function sanitizeLabelText(value?: string | null) {
  if (!value) {
    return 'N/A';
  }

  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class ShippingPdfService {
  generateShippingLabel(
    res: Response,
    order: Order & { profile: Profile | null },
    shipment: Shipment,
  ) {
    const doc = new PDFDocument({
      size: [283.46, 425.2],
      margin: 20,
    });

    const shippingAddress = order.shippingAddress as unknown as ShippingAddress;
    const recipientName =
      sanitizeLabelText(
        `${order.profile?.firstName || ''} ${order.profile?.lastName || ''}`.trim(),
      ) || 'Cliente';
    const recipientPhone = sanitizeLabelText(
      order.profile?.phone || order.customerPhone || 'N/A',
    );
    const city = sanitizeLabelText(
      shippingAddress?.city || order.city || 'N/A',
    );
    const address = sanitizeLabelText(shippingAddress?.address || 'N/A');
    const neighborhood = sanitizeLabelText(shippingAddress?.neighborhood || '');
    const notes = sanitizeLabelText(
      shippingAddress?.notes || shippingAddress?.additionalInfo || '',
    );
    const trackingReference = sanitizeLabelText(
      shipment.trackingNumber || `ORDER-${order.orderNumber}`,
    );

    doc.pipe(res);

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('TOTE BAG', { align: 'center' });
    doc.fontSize(8).font('Helvetica').text('Etiqueta de despacho', {
      align: 'center',
    });
    doc.moveDown();

    doc.moveTo(20, doc.y).lineTo(263, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('REMITENTE:');
    doc.fontSize(8).font('Helvetica');
    SENDER_LINES.forEach((line) => {
      doc.text(line);
    });
    doc.moveDown();

    doc.moveTo(20, doc.y).lineTo(263, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('DESTINATARIO:');
    doc.fontSize(12).font('Helvetica-Bold').text(recipientName.toUpperCase());
    doc.fontSize(9).font('Helvetica').text(`Direccion: ${address}`);
    doc.text(`Barrio/Apto: ${neighborhood === 'N/A' ? '' : neighborhood}`);
    doc.text(`Ciudad: ${city}`);
    doc.text(`Telefono: ${recipientPhone}`);
    doc.moveDown();

    doc.moveTo(20, doc.y).lineTo(263, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(8).font('Helvetica-Bold').text(`ORDEN: #${order.orderNumber}`);
    doc.text(`GUIA: ${trackingReference}`);
    doc.text(`PESO: ${shipment.weight?.toString() || 0} Kg`);
    doc.text(`DIMENSIONES: ${sanitizeLabelText(shipment.dimensions || 'N/A')}`);
    doc.moveDown();

    if (notes && notes !== 'N/A') {
      doc.fontSize(8).font('Helvetica-Bold').text('NOTAS DE ENTREGA:');
      doc.fontSize(8).font('Helvetica').text(notes);
      doc.moveDown();
    }

    doc
      .roundedRect(20, doc.y, 243, 42, 6)
      .lineWidth(1)
      .strokeColor('#111827')
      .stroke();
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(trackingReference, 28, doc.y - 36, {
        width: 227,
        align: 'center',
      });
    doc
      .fontSize(6)
      .font('Helvetica')
      .text('Referencia para soporte logistico', 28, doc.y + 2, {
        width: 227,
        align: 'center',
      });
    doc.moveDown(3.5);

    doc
      .fontSize(7)
      .font('Helvetica')
      .text('Gracias por tu compra en Tote Bag', {
        align: 'center',
      });

    doc.end();
  }
}
