type CellValue = string | number | null | undefined;

export interface SimpleXlsxCell {
  value: CellValue;
  styleId?: number;
}

export interface SimpleXlsxRow {
  cells: Array<CellValue | SimpleXlsxCell>;
  height?: number;
}

export interface SimpleXlsxMergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SimpleXlsxColumn {
  width?: number;
}

export interface SimpleXlsxOptions {
  columns?: SimpleXlsxColumn[];
  merges?: SimpleXlsxMergeRange[];
  stylesXml?: string;
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let value = index + 1;
  let name = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function serializeCell(
  cell: CellValue | SimpleXlsxCell,
  rowIndex: number,
  columnIndex: number,
) {
  const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
  const normalizedCell =
    typeof cell === 'object' && cell !== null && 'value' in cell
      ? cell
      : { value: cell };
  const styleAttribute =
    normalizedCell.styleId !== undefined ? ` s="${normalizedCell.styleId}"` : '';

  if (
    normalizedCell.value === null ||
    normalizedCell.value === undefined ||
    normalizedCell.value === ''
  ) {
    return normalizedCell.styleId !== undefined ? `<c r="${ref}"${styleAttribute}/>` : '';
  }

  if (
    typeof normalizedCell.value === 'number' &&
    Number.isFinite(normalizedCell.value)
  ) {
    return `<c r="${ref}"${styleAttribute}><v>${normalizedCell.value}</v></c>`;
  }

  return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t>${xmlEscape(
    String(normalizedCell.value),
  )}</t></is></c>`;
}

function buildColumnsXml(columns?: SimpleXlsxColumn[]) {
  if (!columns || columns.length === 0) {
    return '';
  }

  const cols = columns
    .map((column, index) => {
      if (!column.width || column.width <= 0) {
        return '';
      }

      const position = index + 1;
      return `<col min="${position}" max="${position}" width="${column.width}" customWidth="1"/>`;
    })
    .join('');

  return cols ? `<cols>${cols}</cols>` : '';
}

function buildMergeCellsXml(merges?: SimpleXlsxMergeRange[]) {
  if (!merges || merges.length === 0) {
    return '';
  }

  const mergeXml = merges
    .map(
      (merge) =>
        `<mergeCell ref="${columnName(merge.startCol)}${merge.startRow}:${columnName(
          merge.endCol,
        )}${merge.endRow}"/>`,
    )
    .join('');

  return `<mergeCells count="${merges.length}">${mergeXml}</mergeCells>`;
}

function buildDefaultStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;
}

function normalizeRows(rows: Array<CellValue[] | SimpleXlsxRow>) {
  return rows.map((row) =>
    Array.isArray(row)
      ? { cells: row }
      : row,
  );
}

function buildSheetXml(rows: Array<CellValue[] | SimpleXlsxRow>, options?: SimpleXlsxOptions) {
  const normalizedRows = normalizeRows(rows);
  const rowXml = rows
    .map((_, rowIndex) => {
      const row = normalizedRows[rowIndex];
      const cells = row.cells
        .map((cell, columnIndex) => serializeCell(cell, rowIndex, columnIndex))
        .join('');
      const heightAttribute =
        row.height && row.height > 0
          ? ` ht="${row.height}" customHeight="1"`
          : '';

      return `<row r="${rowIndex + 1}"${heightAttribute}>${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${buildColumnsXml(options?.columns)}
  <sheetData>${rowXml}</sheetData>
  ${buildMergeCellsXml(options?.merges)}
</worksheet>`;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosDate, dosTime };
}

function createZip(files: Array<{ path: string; content: string | Buffer }>) {
  const chunks: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const content = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, 'utf8');
    const checksum = crc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirectory.push(centralHeader, name);
    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectory.reduce(
    (sum, chunk) => sum + chunk.length,
    0,
  );

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, ...centralDirectory, end]);
}

export function createSimpleXlsxBuffer(
  sheetName: string,
  rows: Array<CellValue[] | SimpleXlsxRow>,
  options?: SimpleXlsxOptions,
) {
  const safeSheetName = xmlEscape(sheetName.slice(0, 31) || 'Sheet1');

  return createZip([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/styles.xml',
      content: options?.stylesXml || buildDefaultStylesXml(),
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      content: buildSheetXml(rows, options),
    },
  ]);
}
