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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Database connection
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

// Routes

// Get all records
app.get('/api/records', async (req, res) => {
  try {
    const records = await AppDataSource.getRepository(PdfRecord).find({
      order: { createdAt: 'DESC' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching records' });
  }
});

// Upload PDFs
app.post('/api/upload', upload.array('pdfs', 100), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const recordRepo = AppDataSource.getRepository(PdfRecord);

    for (const file of files) {
      const record = recordRepo.create({
        filename: file.filename,
        originalName: file.originalname,
        procesado: false,
      });

      // Extract data from PDF using OCR
      try {
        const pdfPath = path.join(__dirname, '../uploads', file.filename);
        if (fs.existsSync(pdfPath)) {
          const extracted = await extractDataFromPDF(pdfPath);
          record.apellidoNombre = extracted.apellidoNombre;
          record.lu = extracted.lu;
          record.codigoCarrera = extracted.codigoCarrera;
          record.plan = extracted.plan;
          record.codigoMateria = extracted.codigoMateria;
          record.genericaAsociada = extracted.genericaAsociada;

          // Fix encoding in originalName
          if (record.originalName) {
            const latin1 = Buffer.from(record.originalName, 'latin1');
            record.originalName = latin1.toString('utf8');
          }
        }
      } catch (ocrError) {
        console.error('OCR extraction error:', ocrError);
      }

      await recordRepo.save(record);
    }

    res.json({ message: 'Files uploaded and processed successfully', count: files.length });
  } catch (error) {
    res.status(500).json({ error: 'Error uploading files' });
  }
});

// Update record
app.put('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { apellidoNombre, lu, codigoCarrera, plan, codigoMateria, genericaAsociada, procesado } = req.body;

    const record = await AppDataSource.getRepository(PdfRecord).findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (apellidoNombre !== undefined) record.apellidoNombre = apellidoNombre;
    if (lu !== undefined) record.lu = lu;
    if (codigoCarrera !== undefined) record.codigoCarrera = codigoCarrera;
    if (plan !== undefined) record.plan = plan;
    if (codigoMateria !== undefined) record.codigoMateria = codigoMateria;
    if (genericaAsociada !== undefined) record.genericaAsociada = genericaAsociada;
    if (procesado !== undefined) record.procesado = procesado;

    await AppDataSource.getRepository(PdfRecord).save(record);
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Error updating record' });
  }
});

// Reprocess OCR for a record
app.post('/api/records/:id/reprocess', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AppDataSource.getRepository(PdfRecord).findOne({ where: { id } });
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const pdfPath = path.join(__dirname, '../uploads', record.filename);
    if (fs.existsSync(pdfPath)) {
      const extracted = await extractDataFromPDF(pdfPath);
      record.apellidoNombre = extracted.apellidoNombre;
      record.lu = extracted.lu;
      record.codigoCarrera = extracted.codigoCarrera;
      record.plan = extracted.plan;
      record.codigoMateria = extracted.codigoMateria;
      record.genericaAsociada = extracted.genericaAsociada;
      await AppDataSource.getRepository(PdfRecord).save(record);
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Error reprocessing record' });
  }
});

// Delete record
app.delete('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AppDataSource.getRepository(PdfRecord).findOne({ where: { id } });

    if (record) {
      const filePath = path.join(__dirname, '../uploads', record.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await AppDataSource.getRepository(PdfRecord).remove(record);
    }

    res.json({ message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting record' });
  }
});

// Export to Excel
app.get('/api/export', async (req, res) => {
  try {
    const records = await AppDataSource.getRepository(PdfRecord).find();

    // Build expanded rows: each code/generica pair is a row; Archivo goes at the end
    const expandedData: any[] = [];

    for (const r of records) {
      const codigos = (r.codigoMateria || '').split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
      const genericas = (r.genericaAsociada || '').split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
      const count = Math.max(codigos.length, genericas.length, 1);

      const base = {
        'Apellido y Nombre': r.apellidoNombre || '',
        'LU': r.lu || '',
        'Código y Carrera': r.codigoCarrera || '',
        'Plan': r.plan || '',
        'Procesado': r.procesado ? 'Sí' : 'No',
        'Código y Materia': '',
        'Genérica Asociada': '',
        'Archivo': r.originalName || '',
      };

      for (let i = 0; i < count; i++) {
        expandedData.push({
          ...base,
          'Código y Materia': codigos[i] || '',
          'Genérica Asociada': genericas[i] || '',
        });
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(expandedData);
    XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');

    // Build merges for columns A-E (0-4) in expanded data rows
    let rowIndex = 1; // Excel row index (1-based, row 0 = header)
    const colCount = 8;

    for (const r of records) {
      const codigos = (r.codigoMateria || '').split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
      const genericas = (r.genericaAsociada || '').split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
      const count = Math.max(codigos.length, genericas.length, 1);
      if (count > 1) {
        ws['!merges'] = ws['!merges'] || [];
        for (let col = 0; col <= 4; col++) {
          ws['!merges'].push({ s: { r: rowIndex, c: col }, e: { r: rowIndex + count - 1, c: col } });
        }
      }
      rowIndex += count;
    }

    // Column widths
    ws['!cols'] = [
      { wch: 28 }, // A
      { wch: 12 }, // B
      { wch: 10 }, // C
      { wch: 10 }, // D
      { wch: 10 }, // E
      { wch: 14 }, // F
      { wch: 18 }, // G
      { wch: 45 }, // H
    ];

    // Write to buffer first (without styles)
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Patch the xlsx zip to add proper styles and cell s attributes
    const zip = new AdmZip(buf);

    // Replace styles.xml with a custom version that has our styles
    const customStylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

    zip.updateFile('xl/styles.xml', Buffer.from(customStylesXml));

    // Patch sheet1.xml to add s="..." attributes to cells
    const sheetEntry = zip.getEntry('xl/worksheets/sheet1.xml');
    if (sheetEntry) {
      let sheetXml = sheetEntry.getData()!.toString('utf8');

      // Add s attribute to each cell: header row (r=1) = s="1", data rows alternate s="2"/s="3"
      sheetXml = sheetXml.replace(/<c r="([A-Z]+\d+)"([^>]*)>/g, (full: string, ref: string, attrs: string): string => {
        const rowMatch = ref.match(/(\d+)$/);
        const excelRow = rowMatch ? parseInt(rowMatch[1]) : 1;
        let sIdx;
        if (excelRow === 1) {
          sIdx = 1; // header
        } else {
          // Data rows: row 2,4,6... = gray (2), row 3,5,7... = white (3)
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
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Error exporting to Excel' });
  }
});

// Start server
AppDataSource.initialize()
  .then(() => {
    console.log('Database connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });