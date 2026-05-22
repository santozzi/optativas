import { Router } from 'express';
import * as testCtrl from '../controllers/testController';

const router = Router();

// Todas aceptan GET con ?filename=<nombre_del_pdf_subido.pdf>

// Librerías que usan texto embebido
router.get('/test/pdftotext', testCtrl.testPdftotext);
router.get('/test/pdfjs', testCtrl.testPdfjs);
router.get('/test/pdf-parse', testCtrl.testPdfParse);
router.get('/test/pdf-parse-new', testCtrl.testPdfParseNew);
router.get('/test/pdf2json', testCtrl.testPdf2json);
router.get('/test/pdf-lib', testCtrl.testPdfLib);

// Librerías que usan imagen + OCR
router.get('/test/pdf2pic', testCtrl.testPdf2pic);
router.get('/test/ghostscript', testCtrl.testGhostscript);

// Estrategia actual del proyecto
router.get('/test/pdftotext-ocr', testCtrl.testPdftotextOcr);

// Comparativa todas
router.get('/test/compare', testCtrl.testCompareAll);

export default router;