import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { DataSource } from 'typeorm';
import { PdfRecord } from './entities/PdfRecord';
import * as XLSX from 'xlsx';
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

    // ── Build expanded rows ──
    const expandedData: any[] = [];

    for (const r of filteredRecords) {
      const mats = r.materiasJson ? JSON.parse(r.materiasJson) : [];
      const anualesRaw = r.anualesJson ? JSON.parse(r.anualesJson) : [];

      const allGenericas: { codigo: string; nombre: string }[] = [];
      for (const a of anualesRaw) {
        if (filtroAnio > 0 && a.año !== filtroAnio) continue;
        for (const g of (a.generica || [])) {
          allGenericas.push({
            codigo: g.código || '',
            nombre: g.materia ? `${g.materia.código} - ${g.materia.nombre}` : '',
          });
        }
      }

      const count = Math.max(mats.length, allGenericas.length, 1);
      const base = {
        'Apellido y Nombre': r.nombre || '',
        'LU': r.lu || '',
        'Código y Carrera': r.carrera || '',
        'Plan': r.plan || '',
        'Código y Materia': '',
        'Genérica Asociada': '',
      };

      for (let i = 0; i < count; i++) {
        const mat = mats[i];
        const gen = allGenericas[i];
        expandedData.push({
          ...base,
          'Código y Materia': mat ? `${mat.codigo} - ${mat.materia}` : '',
          'Genérica Asociada': gen ? `${gen.codigo} - ${gen.nombre}` : '',
        });
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(expandedData);
    XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');

    // ── Merges ──
    let rowIndex = 1;
    for (const r of filteredRecords) {
      const mats = r.materiasJson ? JSON.parse(r.materiasJson) : [];
      const anualesRaw = r.anualesJson ? JSON.parse(r.anualesJson) : [];
      let genericasCount = 0;
      for (const a of anualesRaw) {
        if (filtroAnio > 0 && a.año !== filtroAnio) continue;
        genericasCount += (a.generica || []).length;
      }
      const count = Math.max(mats.length, genericasCount, 1);
      if (count > 1) {
        ws['!merges'] = ws['!merges'] || [];
        for (let col = 0; col <= 3; col++) {
          ws['!merges'].push({ s: { r: rowIndex, c: col }, e: { r: rowIndex + count - 1, c: col } });
        }
      }
      rowIndex += count;
    }

    ws['!cols'] = [
      { wch: 28 }, // A
      { wch: 12 }, // B
      { wch: 10 }, // C
      { wch: 10 }, // D
      { wch: 14 }, // E
      { wch: 18 }, // F
    ];

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename=inscripciones.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
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