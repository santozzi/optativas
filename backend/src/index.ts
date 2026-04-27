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
    
    const data = records.map(r => ({
      'Apellido y Nombre': r.apellidoNombre || '',
      'LU': r.lu || '',
      'Código y Carrera': r.codigoCarrera || '',
      'Plan': r.plan || '',
      'Código y Materia': r.codigoMateria || '',
      'Genérica Asociada': r.genericaAsociada || '',
      'Procesado': r.procesado ? 'Sí' : 'No',
      'Archivo': r.originalName,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    res.setHeader('Content-Disposition', 'attachment; filename=inscripciones.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
  } catch (error) {
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