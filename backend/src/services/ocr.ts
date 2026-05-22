import * as fs from 'fs';
import * as path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { execSync } from 'child_process';
import { Datos, procesarDatos, procesarPedidoOptativas, materiasGenericas } from './texto';
import { repairExtraction } from './extractionRepair';

export interface MateriaOptativa {
  materia: string;
  codigo: string;
  fechaPedido: string;
  plan: string;
}

export interface GenericaItem {
  código: string;
  tipo: string;
  carrera: string;
  plan: number;
  materia?: {
    nombre: string;
    código: string;
  };
}

export interface Anual {
  año: number;
  periodoLectivo: string;
  generica: GenericaItem[];
}

export interface ExtraccionResult {
  lu: string;
  carrera: string;
  documento: string;
  inscripcion: string;
  nombre: string;
  orientacion: string;
  plan: string;
  materias: MateriaOptativa[];
  anuales: Anual[];
}

export async function extractDataFromPDF(pdfPath: string): Promise<ExtraccionResult> {
  let text = '';

  // ── Step 1: pdftotext (texto embebido) ──
  try {
    const raw = execSync(`/usr/bin/pdftotext "${pdfPath}" -`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    text = raw.trim();
    console.log("texto crudo de pdftext: ",text);
  } catch (e) {
    // pdftotext falló, intentar pdfjs como fallback
    try {
      const data = new Uint8Array(fs.readFileSync(pdfPath));
      const doc = await pdfjs.getDocument({ data }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      text = text.trim();
      console.log("texto crudo de pdftext: ",text);
      
    } catch (e2) {
      throw new Error('No se pudo extraer texto del PDF: ' + String(e2));
    }
  }

  // ── Step 2: OCR con Tesseract si faltan campos clave ──
  const hasLU = /L\.?U\.?:/.test(text);
  const hasCOMPLETAR = /COMPLETAR/.test(text);
  const hasPlan = /Plan:/.test(text);

  if (!hasLU || !hasCOMPLETAR || !hasPlan) {
    try {
      const tmpImg = '/tmp/ocr_page.png';
      execSync(`/usr/bin/gs -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 -dPDFFitPage -sOutputFile="${tmpImg}" "${pdfPath}" >/dev/null 2>&1`);
      const ocrText = execSync(`/usr/bin/tesseract "${tmpImg}" stdout -l spa --psm 6`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      const trimmed = ocrText.trim();
      if (/L\.?U\.?:/.test(trimmed) || /Plan:/.test(trimmed)) {
        text = trimmed;
        console.log("texto crudo de pdfocr: ",text);
        console.log('[OCR] Tesseract extrajo texto, length:', text.length);
      } else {
        console.log('[OCR] Tesseract no encontro campos clave, conservando texto original');
      }
    } catch (e: any) {
      console.log('[OCR] Tesseract/GS falló:', e.message);
    }
  }

  // ── Step 3: Parsing con funciones de texto.ts ──

  // Datos header (lu, carrera, documento, inscripcion, nombre, orientacion, plan)
  let datos: Datos;
  try {
    datos = procesarDatos(text);
  } catch (e) {
    // si el regex falla, construir un objeto parcial desde ocr.ts directo
    datos = {
      lu: '', inscripcion: '', nombre: '', documento: '',
      carrera: '', plan: '', orientacion: ''
    };
  }

  // Materias optativas pedidas
  const materias: MateriaOptativa[] = [];
  try {
    const rawMaterias = procesarPedidoOptativas(text);
    if (Array.isArray(rawMaterias)) {
      for (const m of rawMaterias) {
        materias.push({
          materia: m.materia || '',
          codigo: m.codigo || '',
          fechaPedido: m.fechaPedido || '',
          plan: m.plan || '',
        });
      }
    }
  } catch (e) {
    console.log('[Parse] procesarPedidoOptativas falló:', e);
  }

  // Materias genericas/anuales
  const anuales: Anual[] = [];
  try {
    const rawAnuales = materiasGenericas(text);
    if (Array.isArray(rawAnuales)) {
      for (const a of rawAnuales) {
        anuales.push({
          año: typeof a.año === 'number' ? a.año : parseInt(a.año) || 0,
          periodoLectivo: a.periodoLectivo || '',
          generica: Array.isArray(a.generica) ? a.generica : [],
        });
      }
    }
  } catch (e) {
    console.log('[Parse] matriasGenericas falló:', e);
  }

  repairExtraction({ plan: datos.plan || '', materias, anuales, rawText: text });

  return {
    lu: datos.lu || '',
    carrera: datos.carrera || '',
    documento: datos.documento || '',
    inscripcion: datos.inscripcion || '',
    nombre: datos.nombre || '',
    orientacion: datos.orientacion || '',
    plan: datos.plan || '',
    materias,
    anuales,
  };
}
