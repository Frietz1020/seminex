export type ExportFormat = 'csv' | 'md' | 'xlsx';

export type CellValue = string | number | null | undefined;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildCsv(rows: CellValue[][]): Blob {
  const quote = (value: CellValue) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const text = rows.map((row) => row.map(quote).join(',')).join('\r\n');
  return new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' });
}

function buildMarkdown(rows: CellValue[][]): Blob {
  if (rows.length === 0) return new Blob([''], { type: 'text/markdown;charset=utf-8' });
  const escape = (value: CellValue) =>
    String(value ?? '')
      .replaceAll('\\', '\\\\')
      .replaceAll('|', '\\|')
      .replace(/\r?\n/g, ' ');
  const [header, ...body] = rows;
  const colCount = Math.max(...rows.map((row) => row.length));
  const pad = (row: CellValue[]) =>
    Array.from({ length: colCount }, (_, i) => escape(row[i] ?? ''));
  const lines = [
    `| ${pad(header ?? []).join(' | ')} |`,
    `| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`,
    ...body.map((row) => `| ${pad(row).join(' | ')} |`),
  ];
  return new Blob([`${lines.join('\n')}\n`], { type: 'text/markdown;charset=utf-8' });
}

// ---- Minimal standards-compliant OOXML (.xlsx) generator (zero dependencies) ----

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function colLetter(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(entries: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const files = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    return { nameBytes, dataBytes, crc: crc32(dataBytes) };
  });

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const local = new Uint8Array(30 + file.nameBytes.length + file.dataBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // Store
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, file.crc, true);
    lv.setUint32(18, file.dataBytes.length, true);
    lv.setUint32(22, file.dataBytes.length, true);
    lv.setUint16(26, file.nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(file.nameBytes, 30);
    local.set(file.dataBytes, 30 + file.nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + file.nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, file.crc, true);
    cv.setUint32(20, file.dataBytes.length, true);
    cv.setUint32(24, file.dataBytes.length, true);
    cv.setUint16(28, file.nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(file.nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let cursor = 0;
  for (const part of localParts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(eocd, cursor);
  return out;
}

function buildXlsx(rows: CellValue[][], sheetName: string): Blob {
  const safeSheet = xmlEscape(sheetName.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Export');
  const sheetRows = rows
    .map((row, rowIdx) => {
      const rNum = rowIdx + 1;
      const cells = row
        .map((cell, colIdx) => {
          const ref = `${colLetter(colIdx)}${rNum}`;
          const styleAttr = rowIdx === 0 ? ' s="1"' : '';
          if (typeof cell === 'number' && Number.isFinite(cell)) {
            return `<c r="${ref}"${styleAttr}><v>${cell}</v></c>`;
          }
          const text = xmlEscape(String(cell ?? ''));
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join('');
      return `<row r="${rNum}">${cells}</row>`;
    })
    .join('');

  const zipBytes = makeStoredZip([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${safeSheet}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/styles.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '</styleSheet>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${sheetRows}</sheetData>` +
        '</worksheet>',
    },
  ]);

  const copy = new Uint8Array(zipBytes.byteLength);
  copy.set(zipBytes);
  return new Blob([copy.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function exportTable(
  baseFilename: string,
  rows: CellValue[][],
  format: ExportFormat,
  sheetName = 'Export',
) {
  const cleanBase = baseFilename.replace(/\.(csv|md|xlsx)$/i, '');
  if (format === 'csv') {
    triggerDownload(buildCsv(rows), `${cleanBase}.csv`);
    return;
  }
  if (format === 'md') {
    triggerDownload(buildMarkdown(rows), `${cleanBase}.md`);
    return;
  }
  triggerDownload(buildXlsx(rows, sheetName), `${cleanBase}.xlsx`);
}
