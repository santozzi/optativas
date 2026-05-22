import { PdfRecord } from '../entities/PdfRecord';

const XLSX = require('xlsx');
const AdmZip = require('adm-zip');

const HEADERS = ['Apellido y Nombre', 'LU', 'Documento', 'Inscripción', 'Código y Materia', 'Genérica Asociada'];

function parseJsonArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function filterRecordsByYear(records: PdfRecord[], filtroAnio: number) {
  if (filtroAnio <= 0) return records;

  return records.filter(record => {
    const anuales = parseJsonArray(record.anualesJson);
    return anuales.some((a: any) => a.año === filtroAnio);
  });
}

function getGenericasForExport(anualesRaw: any[], filtroAnio: number) {
  const genericas: { codigo: string; nombre: string }[] = [];

  for (const anual of anualesRaw) {
    if (filtroAnio > 0 && anual.año !== filtroAnio) continue;

    for (const generica of (anual.generica || [])) {
      genericas.push({
        codigo: generica.código || '',
        nombre: generica.materia ? `${generica.materia.código} - ${generica.materia.nombre}` : '',
      });
    }
  }

  return genericas;
}

function buildRows(records: PdfRecord[], filtroAnio: number) {
  const data: any[] = [HEADERS];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  for (const record of filterRecordsByYear(records, filtroAnio)) {
    const materias = parseJsonArray(record.materiasJson);
    const genericas = getGenericasForExport(parseJsonArray(record.anualesJson), filtroAnio);
    const count = Math.max(materias.length, genericas.length, 1);
    const startRow = data.length;

    for (let i = 0; i < count; i++) {
      const materia = materias[i];
      const generica = genericas[i];

      data.push([
        record.nombre || '',
        record.lu || '',
        record.documento || '',
        record.inscripcion || '',
        materia ? `${materia.codigo} - ${materia.materia}` : '',
        generica ? `${generica.codigo} - ${generica.nombre}` : '',
      ]);
    }

    if (count > 1) {
      for (let col = 0; col < 4; col++) {
        merges.push({ s: { r: startRow, c: col }, e: { r: startRow + count - 1, c: col } });
      }
    }
  }

  return { data, merges };
}

function applyWorkbookStyle(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  const customStylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF3F4F5F"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF5F5F5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEBEBEB"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF000000"/></left>
      <right style="thin"><color rgb="FF000000"/></right>
      <top style="thin"><color rgb="FF000000"/></top>
      <bottom style="thin"><color rgb="FF000000"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;

  zip.updateFile('xl/styles.xml', Buffer.from(customStylesXml));

  const sheetEntry = zip.getEntry('xl/worksheets/sheet1.xml');
  if (sheetEntry) {
    const sheetXml = sheetEntry.getData().toString('utf8');
    const patched = sheetXml.replace(/<c r="([A-F])(\d+)"([^>]*)>/g, (_full: string, col: string, row: string, attrs: string): string => {
      const excelRow = parseInt(row);
      const styleIndex = excelRow === 1 ? 1 : (excelRow % 2 === 0 ? 2 : 3);
      return `<c r="${col}${row}" s="${styleIndex}"${attrs}>`;
    });
    zip.updateFile('xl/worksheets/sheet1.xml', Buffer.from(patched));
  }

  return zip.toBuffer();
}

export function exportRecordsToExcel(records: PdfRecord[], filtroAnio: number) {
  const { data, merges } = buildRows(records, filtroAnio);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 40 }];
  ws['!merges'] = merges;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  return applyWorkbookStyle(buffer);
}
