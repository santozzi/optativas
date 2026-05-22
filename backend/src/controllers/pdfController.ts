import { Request, Response } from 'express';
import { AppDataSource } from '../index';
import { PdfRecord } from '../entities/PdfRecord';
import { extractDataFromPDF } from '../services/ocr';
import { exportRecordsToExcel } from '../services/excelExport';
import path from 'path';
import fs from 'fs';

const recordRepo = () => AppDataSource.getRepository(PdfRecord);

// ── GET /api/records ──
export async function getRecords(req: Request, res: Response) {
  try {
    const records = await recordRepo().find({ order: { createdAt: 'DESC' } });
    const formatted = records.map(r => ({
      id: r.id,
      filename: r.filename,
      originalName: r.originalName,
      lu: r.lu,
      nombre: r.nombre,
      documento: r.documento,
      inscripcion: r.inscripcion,
      carrera: r.carrera,
      orientacion: r.orientacion,
      plan: r.plan,
      generica: r.anualesJson ? JSON.parse(r.anualesJson) : [],
      procesado: r.procesado,
      createdAt: r.createdAt,
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching records' });
  }
}

// ── POST /api/upload ──
export async function uploadPDFs(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];

    // ── Paso 1: extraer LU de cada PDF ──
    const fileLuMap: { file: Express.Multer.File; lu: string }[] = [];
    for (const file of files) {
      const pdfPath = path.join(__dirname, '../../uploads', file.filename);
      let lu = '';
      if (fs.existsSync(pdfPath)) {
        try {
          const result = await extractDataFromPDF(pdfPath);
          lu = result.lu || '';
        } catch (e) {
          console.error('[Upload] OCR error:', e);
        }
      }
      fileLuMap.push({ file, lu });
    }

    // ── Paso 2: detectar duplicados vs nuevos ──
    const lus = fileLuMap.map(f => f.lu).filter(Boolean);
    let existentes: string[] = [];
    if (lus.length > 0) {
      const duplicates = await recordRepo()
        .createQueryBuilder('record')
        .where('record.lu IN (:...lus)', { lus })
        .getMany();
      existentes = duplicates.map(r => r.lu);
    }

    const nuevos: typeof fileLuMap = [];
    const duplicados: { nombre: string; lu: string }[] = [];

    for (const { file, lu } of fileLuMap) {
      if (lu && existentes.includes(lu)) {
        duplicados.push({ nombre: file.originalname, lu });
        const pdfPath = path.join(__dirname, '../../uploads', file.filename);
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        continue;
      }
      nuevos.push({ file, lu });
    }

    // ── Paso 3: procesar y guardar los nuevos ──
    for (const { file, lu } of nuevos) {
      const pdfPath = path.join(__dirname, '../../uploads', file.filename);
      let result = { lu: '', carrera: '', documento: '', inscripcion: '', nombre: '', orientacion: '', plan: '', materias: [] as any[], anuales: [] as any[] };

      if (fs.existsSync(pdfPath)) {
        try {
          result = await extractDataFromPDF(pdfPath);
          result.lu = lu || result.lu;
        } catch (e) {
          console.error('[Upload] OCR error:', e);
        }
      }

      const record = recordRepo().create({
        filename: file.filename,
        originalName: file.originalname,
        lu: result.lu,
        nombre: result.nombre,
        documento: result.documento,
        inscripcion: result.inscripcion,
        carrera: result.carrera,
        orientacion: result.orientacion,
        plan: result.plan,
        materiasJson: JSON.stringify(result.materias || []),
        anualesJson: JSON.stringify(result.anuales || []),
        procesado: false,
      });

      await recordRepo().save(record);
    }

    res.json({
      message: `Files uploaded successfully`,
      count: nuevos.length,
      duplicates: duplicados,
    });
  } catch (err) {
    console.error('[Upload] Error:', err);
    res.status(500).json({ error: 'Error uploading files' });
  }
}

// ── PUT /api/records/:id ──
export async function updateRecord(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const record = await recordRepo().findOne({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const fields = ['lu', 'nombre', 'documento', 'inscripcion', 'carrera', 'orientacion', 'plan', 'materiasJson', 'anualesJson', 'procesado'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        (record as any)[f] = req.body[f];
      }
    }

    await recordRepo().save(record);
    const formatted = {
      ...record,
      materias: record.materiasJson ? JSON.parse(record.materiasJson) : [],
      anuales: record.anualesJson ? JSON.parse(record.anualesJson) : [],
    };
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Error updating record' });
  }
}

// ── POST /api/records/:id/reprocess ──
export async function reprocessRecord(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const record = await recordRepo().findOne({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const pdfPath = path.join(__dirname, '../../uploads', record.filename);
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

    await recordRepo().save(record);
    res.json({
      ...record,
      materias: result.materias || [],
      anuales: result.anuales || [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Error reprocessing record' });
  }
}

// ── POST /api/records/reprocess-all ──
export async function reprocessAll(req: Request, res: Response) {
  try {
    const records = await recordRepo().find();
    let count = 0;
    for (const record of records) {
      const pdfPath = path.join(__dirname, '../../uploads', record.filename);
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
          await recordRepo().save(record);
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
}

// ── DELETE /api/records ──
export async function deleteAllRecords(req: Request, res: Response) {
  try {
    const records = await recordRepo().find();
    for (const record of records) {
      const filePath = path.join(__dirname, '../../uploads', record.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await recordRepo().remove(record);
    }
    res.json({ message: `Eliminados ${records.length} registros` });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting all records' });
  }
}

// ── DELETE /api/records/:id ──
export async function deleteRecord(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const record = await recordRepo().findOne({ where: { id } });
    if (record) {
      const filePath = path.join(__dirname, '../../uploads', record.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await recordRepo().remove(record);
    }
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting record' });
  }
}

// ── GET /api/export ──
export async function exportExcel(req: Request, res: Response) {
  try {
    const filtroAnio = req.query.anio ? parseInt(String(req.query.anio)) : 0;
    const records = await recordRepo().find();
    const finalBuffer = exportRecordsToExcel(records, filtroAnio);

    res.setHeader('Content-Disposition', 'attachment; filename=inscripciones.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(finalBuffer);
  } catch (err) {
    console.error('[Export] Error:', err);
    res.status(500).json({ error: 'Error exporting to Excel' });
  }
}

// ── GET /api/records/:id/raw-text ──
export async function getRawText(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const record = await recordRepo().findOne({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const pdfPath = path.join(__dirname, '../../uploads', record.filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF not found' });

    const result = await extractDataFromPDF(pdfPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error extracting raw text', detail: String(err) });
  }
}
