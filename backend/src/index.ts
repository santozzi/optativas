import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { DataSource } from 'typeorm';
import { PdfRecord } from './entities/PdfRecord';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { extractDataFromPDF } from './services/ocr';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// ── Multer ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ── Database ──
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'pdfuser',
  password: process.env.DB_PASS || 'pdfpass',
  database: process.env.DB_NAME || 'promedb',
  synchronize: true,
  logging: false,
  entities: [PdfRecord],
});

// ── GET /api/records ──
app.get('/api/records', async (req, res) => {
  try {
    const records = await AppDataSource.getRepository(PdfRecord).find({ order: { createdAt: 'DESC' } });
    const formatted = records.map(r => ({
      ...r,
      materias: r.materiasJson ? JSON.parse(r.materiasJson) : [],
      anuales: r.anualesJson ? JSON.parse(r.anualesJson) : [],
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching records' });
  }
});

// ── POST /api/upload ──
app.post('/api/upload', upload.array('pdfs', 100), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const recordRepo = AppDataSource.getRepository(PdfRecord);

    for (const file of files) {
      const pdfPath = path.join(__dirname, '../uploads', file.filename);

      let result = { lu:'', carrera:'', documento:'', inscripcion:'', nombre:'', orientacion:'', plan:'', materias:[] as any[], anuales:[] as any[] };
      let materiasJson = '[]';
      let anualesJson = '[]';

      if (fs.existsSync(pdfPath)) {
        try {
          result = await extractDataFromPDF(pdfPath);
          materiasJson = JSON.stringify(result.materias || []);
          anualesJson = JSON.stringify(result.anuales || []);
          console.log(result);
          
        } catch (e) {
          console.error('[Upload] OCR error:', e);
        }
      }

      const record = recordRepo.create({
        filename: file.filename,
        originalName: file.originalname,
        lu: result.lu,
        nombre: result.nombre,
        documento: result.documento,
        inscripcion: result.inscripcion,
        carrera: result.carrera,
        orientacion: result.orientacion,
        plan: result.plan,
        materiasJson,
        anualesJson,
        procesado: false,
      });

      await recordRepo.save(record);
    }

    res.json({ message: 'Files uploaded and processed successfully', count: files.length });
  } catch (err) {
    console.error('[Upload] Error:', err);
    res.status(500).json({ error: 'Error uploading files' });
  }
});

// ── PUT /api/records/:id ──
app.put('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AppDataSource.getRepository(PdfRecord).findOne({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const fields = ['lu','nombre','documento','inscripcion','carrera','orientacion','plan','materiasJson','anualesJson','procesado'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        (record as any)[f] = req.body[f];
      }
    }

    await AppDataSource.getRepository(PdfRecord).save(record);
    const formatted = {
      ...record,
      materias: record.materiasJson ? JSON.parse(record.materiasJson) : [],
      anuales: record.anualesJson ? JSON.parse(record.anualesJson) : [],
    };
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Error updating record' });
  }
});

// ── POST /api/records/:id/reprocess ──
app.post('/api/records/:id/reprocess', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AppDataSource.getRepository(PdfRecord).findOne({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const pdfPath = path.join(__dirname, '../uploads', record.filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF not found' });

    const result = await extractDataFromPDF(pdfPath);
    record.lu = result.lu;
    record.nombre = result.nombre;
    record.documento = result.documento;
    record.inscripcion = result.inscripcion;
    record.carrera = result.carrera;
    record.orientacion = result.orientacion;
    record.plan = result.plan;
    record.materiasJson = JSON.stringify(result.materias || []);
    record.anualesJson = JSON.stringify(result.anuales || []);

    await AppDataSource.getRepository(PdfRecord).save(record);
    res.json({
      ...record,
      materias: result.materias || [],
      anuales: result.anuales || [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Error reprocessing record' });
  }
});

// ── POST /api/records/reprocess-all ──
app.post('/api/records/reprocess-all', async (req, res) => {
  try {
    const records = await AppDataSource.getRepository(PdfRecord).find();
    let count = 0;
    for (const record of records) {
      const pdfPath = path.join(__dirname, '../uploads', record.filename);
      if (fs.existsSync(pdfPath)) {
        try {
          const result = await extractDataFromPDF(pdfPath);
          record.lu = result.lu;
          record.nombre = result.nombre;
          record.documento = result.documento;
          record.inscripcion = result.inscripcion;
          record.carrera = result.carrera;
          record.orientacion = result.orientacion;
          record.plan = result.plan;
          record.materiasJson = JSON.stringify(result.materias || []);
          record.anualesJson = JSON.stringify(result.anuales || []);
          await AppDataSource.getRepository(PdfRecord).save(record);
          count++;
        } catch (e) {
          console.error('[reprocess-all] error on', record.filename, e);
        }
      }
    }
    res.json({ message: `Reprocesados ${count} registros`, count });
  } catch (err) {
    res.status(500).json({ error: 'Error reprocessing records' });
  }
});

// ── DELETE /api/records ──
app.delete('/api/records', async (req, res) => {
  try {
    const records = await AppDataSource.getRepository(PdfRecord).find();
    for (const record of records) {
      const filePath = path.join(__dirname, '../uploads', record.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await AppDataSource.getRepository(PdfRecord).remove(record);
    }
    res.json({ message: `Eliminados ${records.length} registros` });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting all records' });
  }
});

// ── DELETE /api/records/:id ──
app.delete('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AppDataSource.getRepository(PdfRecord).findOne({ where: { id } });
    if (record) {
      const filePath = path.join(__dirname, '../uploads', record.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await AppDataSource.getRepository(PdfRecord).remove(record);
    }
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting record' });
  }
});

// ── GET /api/export ──
app.get('/api/export', async (req, res) => {
  try {
    const filtroAnio = req.query.anio ? parseInt(String(req.query.anio)) : 0;
    const records = await AppDataSource.getRepository(PdfRecord).find();

    const filteredRecords = filtroAnio > 0
      ? records.filter(r => {
          const anuales = r.anualesJson ? JSON.parse(r.anualesJson) : [];
          return anuales.some((a: any) => a.año === filtroAnio);
        })
      : records;

    // ── Build AOA (array of arrays) ──
    const HEADERS = ['Apellido y Nombre', 'LU', 'Código y Carrera', 'Plan', 'Código y Materia', 'Genérica Asociada'];

    const dataBorder = {
      top:    { style: 'thin' as const, color: { rgb: '000000' } },
      bottom: { style: 'thin' as const, color: { rgb: '000000' } },
      left:   { style: 'thin' as const, color: { rgb: '000000' } },
      right:  { style: 'thin' as const, color: { rgb: '000000' } },
    };
    const styleLeft = {
      alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
      border: dataBorder, font: { sz: 10 },
    };
    const styleRight = {
      alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
      border: dataBorder, font: { sz: 10 },
    };

    const makeCell = (v: string, s: object) => ({ t: 's' as const, v, s });

    // Header row
    const aoa: any[][] = [HEADERS.map(h => makeCell(h, styleRight))];

    // Data rows + track merges
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

    let recordIndex = 0;
    for (const r of filteredRecords) {
      const mats = r.materiasJson ? JSON.parse(r.materiasJson) : [];
      const anualesRaw = r.anualesJson ? JSON.parse(r.anualesJson) : [];

      const filteredGenericas: { codigo: string; nombre: string }[] = [];
      for (const a of anualesRaw) {
        if (filtroAnio > 0 && a.año !== filtroAnio) continue;
        for (const g of (a.generica || [])) {
          filteredGenericas.push({
            codigo: g.código || '',
            nombre: g.materia ? `${g.materia.código} - ${g.materia.nombre}` : '',
          });
        }
      }

      const count = Math.max(mats.length, filteredGenericas.length, 1);

      const startRow = aoa.length;

      for (let i = 0; i < count; i++) {
        const mat = mats[i];
        const gen = filteredGenericas[i];
        aoa.push([
          makeCell(r.nombre || '', styleLeft),
          makeCell(r.lu || '', styleRight),
          makeCell(r.carrera || '', styleLeft),
          makeCell(r.plan || '', styleRight),
          makeCell(mat ? `${mat.codigo} - ${mat.materia}` : '', styleRight),
          makeCell(gen ? `${gen.codigo} - ${gen.nombre}` : '', styleRight),
        ]);
      }

      if (count > 1) {
        for (let col = 0; col <= 3; col++) {
          merges.push({
            s: { r: startRow, c: col },
            e: { r: startRow + count - 1, c: col },
          });
        }
      }

      recordIndex++;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');

    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 30 }, // A
      { wch: 12 }, // B
      { wch: 14 }, // C
      { wch: 12 }, // D
      { wch: 22 }, // E
      { wch: 35 }, // F
    ];

    // ── Write and patch with AdmZip for full style control ──
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const zip = new AdmZip(buf);

    // Grayscale palette for print:
    // Header:  #3F4F5F  (dark blue-gray, legible but not harsh)
    // Row A:   #F5F5F5  (very light gray)
    // Row B:   #EBEBEB  (medium-light gray)
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
    <!-- s=1: header -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- s=2: data row light gray -->
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- s=3: data row medium gray -->
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`;

    zip.updateFile('xl/styles.xml', Buffer.from(customStylesXml));

    // Add s attribute to each cell: header row = s="1", data rows alternate s="2"/s="3"
    const sheetEntry = zip.getEntry('xl/worksheets/sheet1.xml');
    if (sheetEntry) {
      let sheetXml = sheetEntry.getData()!.toString('utf8');

      sheetXml = sheetXml.replace(/<c r="([A-Z]+\d+)"([^>]*)>/g, (full: string, ref: string, attrs: string): string => {
        const rowMatch = ref.match(/(\d+)$/);
        const excelRow = rowMatch ? parseInt(rowMatch[1]) : 1;
        let sIdx;
        if (excelRow === 1) {
          sIdx = 1; // header
        } else {
          // excelRow 2,4,6... = light gray (s=2), excelRow 3,5,7... = medium gray (s=3)
          sIdx = excelRow % 2 === 0 ? 2 : 3;
        }
        return `<c r="${ref}" s="${sIdx}"${attrs}>`;
      });

      zip.updateFile('xl/worksheets/sheet1.xml', Buffer.from(sheetXml));
    }

    const finalBuffer = zip.toBuffer();

    res.setHeader('Content-Disposition', 'attachment; filename=inscripciones.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(finalBuffer);
  } catch (err) {
    console.error('[Export] Error:', err);
    res.status(500).json({ error: 'Error exporting to Excel' });
  }
});

// ── GET /api/records/:id/raw-text (debug) ──
app.get('/api/records/:id/raw-text', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AppDataSource.getRepository(PdfRecord).findOne({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const pdfPath = path.join(__dirname, '../uploads', record.filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF not found' });

    const result = await extractDataFromPDF(pdfPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error extracting raw text', detail: String(err) });
  }
});

// ── Start ──
AppDataSource.initialize()
  .then(() => {
    console.log('Database connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });