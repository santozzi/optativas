import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as pdfController from '../controllers/pdfController';

const router = Router();

// ── Multer storage ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// ── Records ──
router.get('/records', pdfController.getRecords);
router.put('/records/:id', pdfController.updateRecord);
router.delete('/records', pdfController.deleteAllRecords);
router.delete('/records/:id', pdfController.deleteRecord);
router.post('/records/:id/reprocess', pdfController.reprocessRecord);
router.post('/records/reprocess-all', pdfController.reprocessAll);
router.get('/records/:id/raw-text', pdfController.getRawText);

// ── Upload ──
router.post('/upload', upload.array('pdfs', 100), pdfController.uploadPDFs);

// ── Export ──
router.get('/export', pdfController.exportExcel);

export default router;