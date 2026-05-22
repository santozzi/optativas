import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ── Helpers ──
function sanitizeText(raw: string): string {
  const text = raw
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
    .trim();
    console.log(text);
    
  return text;
}

function getUploadPath(filename: string): string {
  return path.join(__dirname, '../../uploads', filename);
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. pdftotext  (poppler-utils)
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdftotext(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const raw = execSync(`/usr/bin/pdftotext "${pdfPath}" -`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    console.log('[test:pdftotext] raw text length:', raw.length);
    console.log('[test:pdftotext] sample:\n', raw.substring(0, 500));

    res.json({
      library: 'pdftotext (poppler)',
      pages: raw.split('\n\n').length,
      charCount: raw.length,
      text: sanitizeText(raw),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. pdfjs-dist
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdfjs(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    const pagesText: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pagesText.push(content.items.map((item: any) => item.str).join(' '));
    }

    const raw = pagesText.join('\n\n');
    console.log('[test:pdfjs] raw text length:', raw.length);
    console.log('[test:pdfjs] sample:\n', raw.substring(0, 500));

    res.json({
      library: 'pdfjs-dist',
      pages: doc.numPages,
      charCount: raw.length,
      text: sanitizeText(raw),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. pdf-parse
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdfParse(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);

    console.log('[test:pdf-parse] raw text length:', (data.text || '').length);
    console.log('[test:pdf-parse] sample:\n', (data.text || '').substring(0, 500));

    res.json({
      library: 'pdf-parse',
      pages: data.numpages,
      charCount: (data.text || '').length,
      text: sanitizeText(data.text || ''),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. pdf-parse-new
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdfParseNew(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const { parsePdf } = require('pdf-parse-new');
    const dataBuffer = fs.readFileSync(pdfPath);
    // pdf-parse-new
    try {
      const dp = require('pdf-parse-new').default;
      const data = await dp(fs.readFileSync(pdfPath));

      console.log('[test:pdf-parse-new] raw text length:', (data.text || '').length);
      console.log('[test:pdf-parse-new] sample:\n', (data.text || '').substring(0, 500));

      res.json({
        library: 'pdf-parse-new',
        pages: data.numpages ?? data.pages ?? data.info?.Pages ?? 'unknown',
        charCount: (data.text || '').length,
        text: sanitizeText(data.text || ''),
      });
    } catch (err: any) {
      console.log('[test:pdf-parse-new] FAILED:', err.message);
      res.status(500).json({ error: err.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. pdf2json
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdf2json(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const PdfParser = require('pdf2json');
    const pdfParser = new PdfParser();

    const data = await new Promise<any>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', reject);
      pdfParser.on('pdfParser_dataReady', resolve);
      pdfParser.parseBuffer(fs.readFileSync(pdfPath));
    });

    const pages = data.Pages || [];
    const text = pages
      .flatMap((p: any) =>
        (p.Texts || []).map((t: any) =>
          (t.R || []).map((r: any) => r.T).join('')
        ).join(' ')
      )
      .join('\n\n');

    console.log('[test:pdf2json] raw text length:', text.length);
    console.log('[test:pdf2json] sample:\n', text.substring(0, 500));

    res.json({
      library: 'pdf2json',
      pages: pages.length,
      charCount: text.length,
      text: sanitizeText(text),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. pdf-lib  (extrae metadata + texto flat, no renderiza)
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdfLib(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const { PDFDocument } = require('pdf-lib');
    const arrayBuffer = fs.readFileSync(pdfPath);
    const doc = await PDFDocument.load(arrayBuffer);

    const pages = doc.getPages();
    console.log('[test:pdf-lib] pages:', pages.length);
    console.log('[test:pdf-lib] metadata — title:', doc.getTitle(), '| author:', doc.getAuthor());

    res.json({
      library: 'pdf-lib',
      pages: pages.length,
      metadata: {
        title: doc.getTitle(),
        author: doc.getAuthor(),
        subject: doc.getSubject(),
        creator: doc.getCreator(),
        producer: doc.getProducer(),
        creationDate: doc.getCreationDate(),
        modificationDate: doc.getModificationDate(),
      },
      note: 'pdf-lib solo extrae metadata; no extrae texto plano directamente',
      text: '',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. pdftoppm + tesseract (imagen -> OCR) — más confiable que pdf2pic
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdf2pic(req: Request, res: Response) {
  try {
    const { filename, page } = req.query as { filename: string; page?: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const pageNum = parseInt(page || '1');
    const tmpImg = `/tmp/ocr_p${pageNum}.ppm`;

    // pdftoppm renderiza una página específica a imagen
    execSync(`/usr/bin/pdftoppm -r 300 -f ${pageNum} -l ${pageNum} -r 300 "${pdfPath}" "${tmpImg}" >/dev/null 2>&1`);

    // buscar el archivo generado (pdftoppm agrega número al final)
    const tmpDir = '/tmp';
    const generated = fs.readdirSync(tmpDir).find(f => f.startsWith('ocr_p') && f.endsWith('.ppm'));

    if (!generated) {
      return res.status(500).json({ error: 'pdftoppm no generó imagen' });
    }

    const fullPath = path.join(tmpDir, generated);

    // OCR con Tesseract
    const raw = execSync(`/usr/bin/tesseract "${fullPath}" stdout -l spa --psm 6`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    console.log('[test:pdftoppm+tesseract] raw text length:', raw.length);
    console.log('[test:pdftoppm+tesseract] sample:\n', raw.substring(0, 500));

    // Limpiar
    try { fs.unlinkSync(fullPath); } catch (_) {}

    res.json({
      library: 'pdftoppm + tesseract-ocr',
      page: pageNum,
      imageFile: fullPath,
      text: sanitizeText(raw),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 8. Ghostscript (imagen -> OCR) — igual al anterior pero con gs directo
// ─────────────────────────────────────────────────────────────────────────────
export async function testGhostscript(req: Request, res: Response) {
  try {
    const { filename, page } = req.query as { filename: string; page?: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const pageNum = parseInt(page || '1');
    const tmpImg = `/tmp/gs_ocr_p${pageNum}.png`;

    // Renderizar página específica con Ghostscript
    const pageSpec = pageNum === 1 ? '' : ` -dFirstPage=${pageNum} -dLastPage=${pageNum}`;
    execSync(`/usr/bin/gs -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 ${pageSpec} -sOutputFile="${tmpImg}" "${pdfPath}" >/dev/null 2>&1`);

    // OCR con Tesseract
    const raw = execSync(`/usr/bin/tesseract "${tmpImg}" stdout -l spa --psm 6`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    console.log('[test:ghostscript] raw text length:', raw.length);
    console.log('[test:ghostscript] sample:\n', raw.substring(0, 500));

    res.json({
      library: 'ghostscript + tesseract-ocr',
      page: pageNum,
      charCount: raw.length,
      text: sanitizeText(raw),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 9. pdftotext con OCR fallback (estrategia actual del proyecto)
// ─────────────────────────────────────────────────────────────────────────────
export async function testPdftotextOcr(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    let text = '';
    let strategy = 'unknown';
    let charCount = 0;

    // Intento 1: pdftotext
    try {
      const raw = execSync(`/usr/bin/pdftotext "${pdfPath}" -`, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
      });
      text = raw.trim();
      charCount = text.length;
      strategy = 'pdftotext';
      console.log('[test:pdftotext-ocr] primary (pdftotext) chars:', charCount, '| sample:', text.substring(0, 200));
    } catch (e1) {
      // Intento 2: pdfjs
      try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument({ data }).promise;
        const pagesText: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          pagesText.push(content.items.map((item: any) => item.str).join(' '));
        }
        text = pagesText.join('\n\n');
        charCount = text.length;
        strategy = 'pdfjs-dist';
        console.log('[test:pdftotext-ocr] fallback (pdfjs) chars:', charCount, '| sample:', text.substring(0, 200));
      } catch (e2) {
        return res.status(500).json({ error: `Both pdftotext and pdfjs failed: ${e1}, ${e2}` });
      }
    }

    // Si falta contenido clave → OCR con Ghostscript
    const hasLU = /L\.?U\.?:/.test(text);
    const hasCOMPLETAR = /COMPLETAR/.test(text);
    const hasPlan = /Plan:/.test(text);

    let ocrText = null;
    if (!hasLU || !hasCOMPLETAR || !hasPlan) {
      try {
        const tmpImg = '/tmp/ocr_full.png';
        execSync(`/usr/bin/gs -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 -dPDFFitPage -sOutputFile="${tmpImg}" "${pdfPath}" >/dev/null 2>&1`);
        const raw = execSync(`/usr/bin/tesseract "${tmpImg}" stdout -l spa --psm 6`, {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
        });
        ocrText = raw.trim();
        console.log('[test:pdftotext-ocr] OCR fallback triggered, chars:', ocrText.length, '| sample:', ocrText.substring(0, 200));
        try { fs.unlinkSync(tmpImg); } catch (_) {}
      } catch (e3) {
        // OCR falló, se conserva lo que se pudo extraer
      }
    }

    res.json({
      strategy,
      ocrFallback: ocrText !== null,
      primaryCharCount: charCount,
      primaryText: sanitizeText(text),
      ocrCharCount: ocrText ? ocrText.length : null,
      ocrText: ocrText ? sanitizeText(ocrText) : null,
      fieldsFound: {
        hasLU,
        hasCOMPLETAR,
        hasPlan,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 10. Comparativa completa (todas las librerías)
// ─────────────────────────────────────────────────────────────────────────────
export async function testCompareAll(req: Request, res: Response) {
  try {
    const { filename } = req.query as { filename: string };
    if (!filename) return res.status(400).json({ error: 'filename es requerido' });

    const pdfPath = getUploadPath(filename);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'PDF no encontrado' });

    const results: Record<string, { success: boolean; pages?: number; charCount?: number; error?: string; sampleText?: string }> = {};

    // pdftotext
    try {
      const raw = execSync(`/usr/bin/pdftotext "${pdfPath}" -`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
      const t = raw.trim();
      console.log('[compare:pdftotext] ok, chars:', t.length, '| sample:', t.substring(0, 200));
      results['pdftotext'] = { success: true, charCount: t.length, sampleText: t.substring(0, 300) };
    } catch (e: any) {
      console.log('[compare:pdftotext] FAILED:', e.message);
      results['pdftotext'] = { success: false, error: e.message };
    }

    // pdfjs
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
      const data = new Uint8Array(fs.readFileSync(pdfPath));
      const doc = await pdfjsLib.getDocument({ data }).promise;
      const parts: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map((item: any) => item.str).join(' '));
      }
      const t = parts.join('\n\n');
      console.log('[compare:pdfjs-dist] ok, chars:', t.length, '| sample:', t.substring(0, 200));
      results['pdfjs-dist'] = { success: true, pages: doc.numPages, charCount: t.length, sampleText: t.substring(0, 300) };
    } catch (e: any) {
      console.log('[compare:pdfjs-dist] FAILED:', e.message);
      results['pdfjs-dist'] = { success: false, error: e.message };
    }

    // pdf-parse
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(fs.readFileSync(pdfPath));
      const t = (data.text || '').trim();
      console.log('[compare:pdf-parse] ok, chars:', t.length, '| sample:', t.substring(0, 200));
      results['pdf-parse'] = { success: true, pages: data.numpages, charCount: t.length, sampleText: t.substring(0, 300) };
    } catch (e: any) {
      console.log('[compare:pdf-parse] FAILED:', e.message);
      results['pdf-parse'] = { success: false, error: e.message };
    }

    // pdf-parse-new
    try {
      const dp = require('pdf-parse-new').default;
      const data = await dp(fs.readFileSync(pdfPath));
      const t = (data.text || '').trim();
      console.log('[compare:pdf-parse-new] ok, chars:', t.length, '| sample:', t.substring(0, 200));
      results['pdf-parse-new'] = { success: true, charCount: t.length, sampleText: t.substring(0, 300) };
    } catch (e: any) {
      console.log('[compare:pdf-parse-new] FAILED:', e.message);
      results['pdf-parse-new'] = { success: false, error: e.message };
    }

    // pdf2json
    try {
      const PdfParser = require('pdf2json');
      const pdfParser = new PdfParser();
      const data = await new Promise<any>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', reject);
        pdfParser.on('pdfParser_dataReady', resolve);
        pdfParser.parseBuffer(fs.readFileSync(pdfPath));
      });
      const pages = data.Pages || [];
      const t = pages.flatMap((p: any) =>
        (p.Texts || []).map((t: any) => (t.R || []).map((r: any) => r.T).join('')).join(' ')
      ).join('\n\n');
      console.log('[compare:pdf2json] ok, chars:', t.length, '| sample:', t.substring(0, 200));
      results['pdf2json'] = { success: true, pages: pages.length, charCount: t.length, sampleText: t.substring(0, 300) };
    } catch (e: any) {
      console.log('[compare:pdf2json] FAILED:', e.message);
      results['pdf2json'] = { success: false, error: e.message };
    }

    // pdf-lib
    try {
      const { PDFDocument } = require('pdf-lib');
      const doc = await PDFDocument.load(fs.readFileSync(pdfPath));
      console.log('[compare:pdf-lib] ok, pages:', doc.getPages().length, '| title:', doc.getTitle());
      results['pdf-lib'] = {
        success: true,
        pages: doc.getPages().length,
        charCount: -1,
        sampleText: `[metadata only] title: ${doc.getTitle()} | author: ${doc.getAuthor()} | subject: ${doc.getSubject()}`,
      };
    } catch (e: any) {
      console.log('[compare:pdf-lib] FAILED:', e.message);
      results['pdf-lib'] = { success: false, error: e.message };
    }

    // ghostscript + tesseract
    try {
      const tmpImg = '/tmp/gs_compare.png';
      execSync(`/usr/bin/gs -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 -dPDFFitPage -sOutputFile="${tmpImg}" "${pdfPath}" >/dev/null 2>&1`);
      const raw = execSync(`/usr/bin/tesseract "${tmpImg}" stdout -l spa --psm 6`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
      const t = raw.trim();
      try { fs.unlinkSync(tmpImg); } catch (_) {}
      console.log('[compare:ghostscript+tesseract] ok, chars:', t.length, '| sample:', t.substring(0, 200));
      results['ghostscript+tesseract'] = { success: true, charCount: t.length, sampleText: t.substring(0, 300) };
    } catch (e: any) {
      console.log('[compare:ghostscript+tesseract] FAILED:', e.message);
      results['ghostscript+tesseract'] = { success: false, error: e.message };
    }

    console.log('[compare:all] Done. Summary:');
    for (const [lib, res2] of Object.entries(results)) {
      console.log(`  ${lib}: ${res2.success ? 'OK (' + res2.charCount + ' chars)' : 'FAIL - ' + res2.error}`);
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}