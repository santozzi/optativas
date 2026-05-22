import * as fs from 'fs';
import * as path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { execSync } from 'child_process';
import { Datos, procesarDatos, procesarPedidoOptativas, matriasGenericas } from './texto';

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
    const rawAnuales = matriasGenericas(text);
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

  const carreraPlanYear = (datos.plan || '').match(/20\d{2}/)?.[0] || '';
  const normalizeName = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ñ/g, 'N')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();

  const materiasByName = new Map<string, MateriaOptativa>();
  for (const materia of materias) {
    if (!materia.plan && carreraPlanYear) materia.plan = carreraPlanYear;
    materiasByName.set(normalizeName(materia.materia), materia);
  }

  for (const anual of anuales) {
    for (const generica of anual.generica) {
      if (!generica.materia) continue;
      if (!generica.materia.código) {
        const genericaName = normalizeName(generica.materia.nombre);
        const match = [...materiasByName.values()].find(m => {
          const materiaName = normalizeName(m.materia);
          return materiaName === genericaName || materiaName.startsWith(genericaName) || genericaName.startsWith(materiaName);
        });
        if (match) generica.materia.código = match.codigo;
      }
    }
  }

  const invalidMaterias = materias.length > 0 && materias.some(m =>
    !/^\d{4,6}$/.test(m.codigo) || !/^\d{2}\/\d{2}\/\d{4}$/.test(m.fechaPedido)
  );

  if (invalidMaterias) {
    const fallbackGenericas = anuales
      .filter(a => a.año !== 6)
      .flatMap(a => a.generica)
      .filter(g => g.materia?.nombre && g.materia?.código);

    if (fallbackGenericas.length > 0) {
      const datePlanByCode = new Map<string, { fechaPedido: string; plan: string }>();
      const codeDateRegex = /(\d{4,6})\s*\n+\s*(\d{2}\/\d{2}\/\d{4})(?:\s+((?:20)?\d{2,4}))?/g;
      for (const match of text.matchAll(codeDateRegex)) {
        const plan = match[3] && /^20\d{2}$/.test(match[3]) ? match[3] : carreraPlanYear;
        datePlanByCode.set(match[1], { fechaPedido: match[2], plan: plan || '' });
      }

      materias.splice(0, materias.length, ...fallbackGenericas.map(g => {
        const codigo = g.materia?.código || '';
        const datePlan = datePlanByCode.get(codigo);
        return {
          materia: g.materia?.nombre || '',
          codigo,
          fechaPedido: datePlan?.fechaPedido || '',
          plan: datePlan?.plan || carreraPlanYear,
        };
      }));
    }
  }

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
