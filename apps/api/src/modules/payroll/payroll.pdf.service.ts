import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import {
  PayrollBillingStatement,
  PayrollShift,
} from '../../generated/client/client';

type PayrollStatementWithShifts = PayrollBillingStatement & {
  shifts: PayrollShift[];
};

@Injectable()
export class PayrollPdfService {
  generateStatementPdf(res: Response, statement: PayrollStatementWithShifts) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('TOTE BAG', {
      align: 'left',
    });
    doc.fontSize(10).font('Helvetica').text('Cuenta de cobro de nomina');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`);
    doc.moveDown();

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`CUENTA DE COBRO #${statement.id}`, { align: 'right' });
    doc
      .fontSize(11)
      .font('Helvetica')
      .text(`Estado: ${statement.status}`, { align: 'right' });
    doc.text(
      `Periodo: ${this.formatDate(statement.periodStart)} al ${this.formatDate(statement.periodEnd)}`,
      { align: 'right' },
    );
    doc.moveDown(2);

    doc.fontSize(12).font('Helvetica-Bold').text('COLABORADOR');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(statement.collaborator || 'Varios colaboradores');
    doc.moveDown();

    const summaryTop = doc.y;
    doc.font('Helvetica-Bold').text('Turnos', 50, summaryTop);
    doc.text('Fecha emision', 180, summaryTop);
    doc.text('Valor total', 360, summaryTop, { width: 150, align: 'right' });

    const summaryValuesY = summaryTop + 18;
    doc.font('Helvetica');
    doc.text(String(statement.shifts.length), 50, summaryValuesY);
    doc.text(this.formatDate(statement.createdAt), 180, summaryValuesY);
    doc.text(this.formatCurrency(statement.totalAmount), 360, summaryValuesY, {
      width: 150,
      align: 'right',
    });
    doc
      .moveTo(50, summaryValuesY + 20)
      .lineTo(545, summaryValuesY + 20)
      .stroke();

    const tableTop = summaryValuesY + 40;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Fecha', 50, tableTop);
    doc.text('Horario', 130, tableTop);
    doc.text('Descanso', 245, tableTop);
    doc.text('Observaciones', 320, tableTop, { width: 120 });
    doc.text('Valor', 450, tableTop, { width: 95, align: 'right' });
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(545, tableTop + 15)
      .stroke();

    let currentY = tableTop + 25;
    statement.shifts.forEach((shift) => {
      const observations = shift.notes?.trim() || 'Sin observaciones';

      if (currentY > 720) {
        doc.addPage();
        currentY = 60;
      }

      doc.fontSize(9).font('Helvetica');
      doc.text(this.formatDate(shift.workDate), 50, currentY, { width: 70 });
      doc.text(`${shift.startTime} - ${shift.endTime}`, 130, currentY, {
        width: 100,
      });
      doc.text(`${shift.breakMinutes} min`, 245, currentY, { width: 60 });
      doc.text(observations, 320, currentY, { width: 120 });
      doc.text(this.formatCurrency(shift.totalAmount), 450, currentY, {
        width: 95,
        align: 'right',
      });

      currentY += Math.max(20, Math.ceil(observations.length / 28) * 12);
    });

    const totalsY = currentY + 20;
    doc.moveTo(330, totalsY).lineTo(545, totalsY).stroke();
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('TOTAL', 360, totalsY + 10, { width: 70, align: 'right' });
    doc.text(this.formatCurrency(statement.totalAmount), 430, totalsY + 10, {
      width: 115,
      align: 'right',
    });

    if (statement.sentAt || statement.paidAt) {
      doc.moveDown(2);
      doc.fontSize(10).font('Helvetica-Bold').text('TRAZABILIDAD');
      doc.font('Helvetica');

      if (statement.sentAt) {
        doc.text(`Enviada: ${this.formatDate(statement.sentAt)}`);
      }

      if (statement.paidAt) {
        doc.text(`Pagada: ${this.formatDate(statement.paidAt)}`);
      }
    }

    doc.moveDown(2);
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Documento generado desde el modulo de nomina de Tote Bag. Los valores reflejan turnos persistidos en el sistema.',
        50,
        770,
        { align: 'center', width: 495 },
      );

    doc.end();
  }

  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private formatDate(date: Date) {
    return new Date(date).toLocaleDateString('es-CO');
  }
}
