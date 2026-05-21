import {
  type SimpleXlsxCell,
  type SimpleXlsxMergeRange,
  type SimpleXlsxRow,
} from './simple-xlsx.util';

type PdfTextOptions = {
  align?: 'left' | 'center' | 'right';
  width?: number;
};

interface ReportPdfDocument {
  addPage(): ReportPdfDocument;
  fill(): ReportPdfDocument;
  fillColor(color: string): ReportPdfDocument;
  font(name: string): ReportPdfDocument;
  fontSize(size: number): ReportPdfDocument;
  heightOfString(text: string, options?: PdfTextOptions): number;
  lineTo(x: number, y: number): ReportPdfDocument;
  lineWidth(width: number): ReportPdfDocument;
  moveTo(x: number, y: number): ReportPdfDocument;
  rect(x: number, y: number, width: number, height: number): ReportPdfDocument;
  stroke(): ReportPdfDocument;
  strokeColor(color: string): ReportPdfDocument;
  text(
    text: string,
    x?: number,
    y?: number,
    options?: PdfTextOptions,
  ): ReportPdfDocument;
}

export const BRANDED_REPORT_STYLE_IDS = {
  base: 0,
  surface: 1,
  companyTitle: 2,
  companySubtitle: 3,
  metaTitle: 4,
  metaText: 5,
  sectionTitle: 6,
  rowLabel: 7,
  rowValue: 8,
  rowValuePositive: 9,
  rowValueNegative: 10,
  darkHeaderLeft: 11,
  darkHeaderRight: 12,
  footnote: 13,
  gutter: 14,
} as const;

export const BRANDED_REPORT_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="12">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="24"/><name val="Calibri"/><family val="2"/><color rgb="FF2D3436"/></font>
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF636E72"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF2D3436"/></font>
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF4B5563"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/><family val="2"/><color rgb="FF2D3436"/></font>
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF636E72"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF111827"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF00B894"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FFD63031"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/><family val="2"/><color rgb="FFFFFFFF"/></font>
    <font><sz val="9"/><name val="Calibri"/><family val="2"/><color rgb="FF9CA3AF"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8F9FA"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2D3436"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border/>
    <border>
      <bottom style="medium"><color rgb="FF2D3436"/></bottom>
    </border>
    <border>
      <bottom style="thin"><color rgb="FFF1F2F6"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="11" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

export function brandedCell(
  value: string | number | null,
  styleId?: number,
): SimpleXlsxCell {
  return {
    value,
    styleId,
  };
}

export function brandedEmptyCells(count: number, styleId?: number) {
  return Array.from({ length: count }, () => brandedCell(null, styleId));
}

function normalizeTotalColumns(totalColumns: number) {
  return Math.max(totalColumns, 6);
}

export function createBrandedReportHeaderRows(input: {
  title: string;
  generatedLabel: string;
  periodLabel?: string | null;
  totalColumns: number;
}): SimpleXlsxRow[] {
  const totalColumns = normalizeTotalColumns(input.totalColumns);
  const rightStart = totalColumns - 2;
  const rows: SimpleXlsxRow[] = [];

  const createHeaderRow = (
    leftValue: string | null,
    leftStyleId: number,
    rightValue: string | null,
    rightStyleId: number,
    height: number,
  ) => {
    const cells: SimpleXlsxCell[] = [];
    cells.push(brandedCell(null, BRANDED_REPORT_STYLE_IDS.gutter));
    cells.push(brandedCell(leftValue, leftStyleId));

    for (let index = 2; index < totalColumns; index += 1) {
      if (index === rightStart) {
        cells.push(brandedCell(rightValue, rightStyleId));
      } else {
        cells.push(brandedCell(null, BRANDED_REPORT_STYLE_IDS.surface));
      }
    }

    rows.push({ height, cells });
  };

  rows.push({
    height: 12,
    cells: [
      brandedCell(null, BRANDED_REPORT_STYLE_IDS.gutter),
      ...brandedEmptyCells(totalColumns - 1),
    ],
  });

  createHeaderRow(
    'TOTE BAG CO.',
    BRANDED_REPORT_STYLE_IDS.companyTitle,
    input.title,
    BRANDED_REPORT_STYLE_IDS.metaTitle,
    26,
  );
  createHeaderRow(
    null,
    BRANDED_REPORT_STYLE_IDS.surface,
    input.generatedLabel,
    BRANDED_REPORT_STYLE_IDS.metaText,
    20,
  );
  createHeaderRow(
    'Medellin, Colombia',
    BRANDED_REPORT_STYLE_IDS.companySubtitle,
    input.periodLabel ?? null,
    BRANDED_REPORT_STYLE_IDS.metaText,
    20,
  );
  rows.push({
    height: 12,
    cells: [
      brandedCell(null, BRANDED_REPORT_STYLE_IDS.gutter),
      ...brandedEmptyCells(totalColumns - 1),
    ],
  });

  return rows;
}

export function createBrandedReportHeaderMerges(totalColumns: number) {
  const normalizedColumns = normalizeTotalColumns(totalColumns);
  const rightStart = normalizedColumns - 2;
  const rightEnd = normalizedColumns - 1;

  return [
    { startRow: 2, startCol: 1, endRow: 3, endCol: 3 },
    { startRow: 2, startCol: rightStart, endRow: 2, endCol: rightEnd },
    { startRow: 3, startCol: rightStart, endRow: 3, endCol: rightEnd },
    { startRow: 4, startCol: 1, endRow: 4, endCol: 3 },
    { startRow: 4, startCol: rightStart, endRow: 4, endCol: rightEnd },
  ] satisfies SimpleXlsxMergeRange[];
}

export function createBrandedSectionRow(
  label: string,
  totalColumns: number,
): SimpleXlsxRow {
  const normalizedColumns = normalizeTotalColumns(totalColumns);

  return {
    height: 22,
    cells: [
      brandedCell(null, BRANDED_REPORT_STYLE_IDS.base),
      brandedCell(label, BRANDED_REPORT_STYLE_IDS.sectionTitle),
      ...brandedEmptyCells(
        normalizedColumns - 2,
        BRANDED_REPORT_STYLE_IDS.sectionTitle,
      ),
    ],
  };
}

export function createBrandedSectionMerge(
  rowNumber: number,
  totalColumns: number,
) {
  return {
    startRow: rowNumber,
    startCol: 1,
    endRow: rowNumber,
    endCol: normalizeTotalColumns(totalColumns) - 1,
  } satisfies SimpleXlsxMergeRange;
}

export function createBrandedFooterRow(
  text: string,
  totalColumns: number,
): SimpleXlsxRow {
  const normalizedColumns = normalizeTotalColumns(totalColumns);

  return {
    height: 28,
    cells: [
      brandedCell(null, BRANDED_REPORT_STYLE_IDS.base),
      brandedCell(text, BRANDED_REPORT_STYLE_IDS.footnote),
      ...brandedEmptyCells(
        normalizedColumns - 2,
        BRANDED_REPORT_STYLE_IDS.footnote,
      ),
    ],
  };
}

export interface BrandedPdfLayout {
  currentY: number;
  readonly doc: ReportPdfDocument;
  readonly startX: number;
  readonly rightX: number;
  readonly contentWidth: number;
  readonly bottomLimit: number;
}

export function createBrandedPdfLayout(
  doc: ReportPdfDocument,
  input: {
    title: string;
    generatedLabel: string;
    periodLabel?: string | null;
  },
): BrandedPdfLayout {
  doc.rect(0, 0, 612, 100).fillColor('#F8F9FA').fill();
  doc.rect(0, 0, 5, 100).fillColor('#2D3436').fill();

  doc
    .fillColor('#2D3436')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('TOTE BAG CO.', 50, 40);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#636E72')
    .text('Medellin, Colombia', 50, 70);

  doc
    .fillColor('#2D3436')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(input.title, 400, 45, { align: 'right' });
  doc.font('Helvetica').text(input.generatedLabel, 400, 60, {
    align: 'right',
  });

  if (input.periodLabel) {
    doc.text(input.periodLabel, 400, 75, { align: 'right' });
  }

  return {
    doc,
    currentY: 140,
    startX: 50,
    rightX: 550,
    contentWidth: 500,
    bottomLimit: 730,
  };
}

export function ensureBrandedPdfSpace(
  layout: BrandedPdfLayout,
  requiredHeight: number,
) {
  if (layout.currentY + requiredHeight <= layout.bottomLimit) {
    return;
  }

  layout.doc.addPage();
  layout.currentY = 40;
}

export function drawBrandedPdfSectionTitle(
  layout: BrandedPdfLayout,
  title: string,
) {
  ensureBrandedPdfSpace(layout, 32);
  layout.doc
    .fillColor('#2D3436')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(title, layout.startX, layout.currentY);
  layout.currentY += 20;
  layout.doc
    .moveTo(layout.startX, layout.currentY)
    .lineTo(layout.rightX, layout.currentY)
    .strokeColor('#2D3436')
    .lineWidth(1.5)
    .stroke();
  layout.currentY += 15;
}

export function drawBrandedPdfKeyValueRow(
  layout: BrandedPdfLayout,
  label: string,
  value: string,
  options?: {
    tone?: 'default' | 'positive' | 'negative';
    emphasized?: boolean;
    final?: boolean;
  },
) {
  ensureBrandedPdfSpace(layout, options?.final ? 38 : 26);

  if (options?.final) {
    layout.doc
      .rect(layout.startX - 10, layout.currentY - 5, 520, 35)
      .fillColor('#2D3436')
      .fill();
    layout.doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12);
  } else {
    layout.doc
      .fillColor(options?.emphasized ? '#2D3436' : '#636E72')
      .font(options?.emphasized ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10);
  }

  layout.doc.text(label, layout.startX, layout.currentY + 5);

  if (options?.final) {
    layout.doc.fillColor('#FFFFFF');
  } else if (options?.tone === 'negative') {
    layout.doc.fillColor('#D63031');
  } else if (options?.tone === 'positive') {
    layout.doc.fillColor('#00B894');
  }

  layout.doc.text(value, 400, layout.currentY + 5, {
    align: 'right',
    width: 150,
  });

  layout.currentY += 30;

  if (!options?.final) {
    layout.doc
      .moveTo(layout.startX, layout.currentY - 5)
      .lineTo(layout.rightX, layout.currentY - 5)
      .strokeColor('#F1F2F6')
      .lineWidth(0.5)
      .stroke();
  }
}

export function drawBrandedPdfParagraph(
  layout: BrandedPdfLayout,
  text: string,
) {
  const height = layout.doc.heightOfString(text, {
    width: layout.contentWidth,
  });
  ensureBrandedPdfSpace(layout, height + 8);
  layout.doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#475569')
    .text(text, layout.startX, layout.currentY, { width: layout.contentWidth });
  layout.currentY += height + 8;
}

export function drawBrandedPdfFooter(
  layout: BrandedPdfLayout,
  text: string,
  footerY = 700,
) {
  layout.doc
    .fontSize(8)
    .fillColor('#B2BEC3')
    .text(text, layout.startX, footerY, {
      align: 'center',
      width: 512,
    });
}
