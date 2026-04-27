import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export async function extractDataFromPDF(pdfPath: string): Promise<{ 
  apellidoNombre: string;
  lu: string;
  codigoCarrera: string;
  plan: string;
  codigoMateria: string;
  genericaAsociada: string;
}> {
  const tempDir = os.tmpdir();
  const baseName = `ocr_${Date.now()}`;
  const unlockedPdf = path.join(tempDir, `unlocked_${baseName}.pdf`);
  const txtFile = path.join(tempDir, `${baseName}.txt`);

  try {
    // Unlock PDF
    try {
      await execAsync(`qpdf --decrypt "${pdfPath}" "${unlockedPdf}"`);
    } catch {
      fs.copyFileSync(pdfPath, unlockedPdf);
    }

    // Try pdftotext first (fast)
    let text = '';
    try {
      await execAsync(`pdftotext -layout "${unlockedPdf}" "${txtFile}"`);
      if (fs.existsSync(txtFile)) {
        text = fs.readFileSync(txtFile, 'utf8');
      }
    } catch {}

    // If no text found, use OCR (gs + tesseract)
    if (!text || text.length < 50) {
      const tempImage = path.join(tempDir, `${baseName}.png`);
      await execAsync(`gs -dNOPAUSE -dBATCH -sDEVICE=png256 -r300 -sOutputFile="${tempImage.replace('.png', '_%03d.png')}" "${unlockedPdf}"`);
      const page1 = tempImage.replace('.png', '_001.png');
      if (fs.existsSync(page1)) {
        const { stdout } = await execAsync(`tesseract "${page1}" stdout -l spa`);
        text = stdout;
      }
    }

    if (!text || text.length < 50) {
      throw new Error('Could not extract text');
    }

    return parsePdfData(text);
  } catch (error) {
    console.error('Extract Error:', error);
    return {
      apellidoNombre: '',
      lu: '',
      codigoCarrera: '',
      plan: '',
      codigoMateria: '',
      genericaAsociada: '',
    };
  } finally {
    try {
      if (fs.existsSync(txtFile)) fs.unlinkSync(txtFile);
      if (fs.existsSync(unlockedPdf)) fs.unlinkSync(unlockedPdf);
      const files = fs.readdirSync(tempDir);
      for (const f of files) {
        if (f.includes(baseName)) {
          fs.unlinkSync(path.join(tempDir, f));
        }
      }
    } catch {}
  }
}

function parsePdfData(text: string): { 
  apellidoNombre: string;
  lu: string;
  codigoCarrera: string;
  plan: string;
  codigoMateria: string;
  genericaAsociada: string;
} {
  // === Extract LU ===
  let lu = '';
  const luMatch = text.match(/(?:L\.?U\.?|Nro\.? de Inscripci[óÓ]n)\.?:\s*(\d+)/i);
  if (luMatch) lu = luMatch[1];

  // === Extract Apellido y Nombre - look for exact label ===
  let apellidoNombre = '';
  
  // Find "Apellido y Nombre:" and get text after it on same line
  const nameLineMatch = text.match(/Apellido y Nombre:\s*([^\n]+)/i);
  if (nameLineMatch) {
    let nombre = nameLineMatch[1].trim();
    // Remove "Tipo y Nro. de Documento:" if present
    nombre = nombre.replace(/Tipo y Nro\..*/i, '').replace(/DNI.*/i, '').trim();
    // Remove trailing comma
    if (nombre.endsWith(',')) nombre = nombre.slice(0, -1);
    // Also remove "Universidad Nacional del Sur" etc
    nombre = nombre.replace(/Universidad.*/i, '').replace(/G3W.*/i, '').trim();
    if (nombre && nombre.length > 3) {
      // Format as "APELLIDO, Nombre(s)"
      const parts = nombre.split(/[,\s]+/).filter(p => p.length > 0);
      if (parts.length >= 2) {
        // First part is last name, rest are first names
        apellidoNombre = `${parts[0].toUpperCase()}, ${parts.slice(1).join(' ')}`;
      } else if (parts.length === 1) {
        apellidoNombre = `${parts[0]},`;
      }
    }
  }

  // === Extract Carrera ===
  let codigoCarrera = '';
  const carreraMatch = text.match(/\((\d+)\)\s*([A-Z]+)/i);
  if (carreraMatch) codigoCarrera = carreraMatch[1];

  // === Extract Plan ===
  let plan = '';
  const planMatch = text.match(/Plan:\s*(\d{4})\s*\/\s*(\d+)/i);
  if (planMatch) plan = `${planMatch[1]}/${planMatch[2]}`;

  // === Extract Código Materia - look for 5-digit codes in "Pedidos de Optativas Vigentes" section ===
  let codigoMateria = '';
  
  // Find "Pedidos de Optativas Vigentes" section and extract materia codes
  const pedidosSection = text.match(/Pedidos de Optativas Vigentes[\s\S]{0,500}/i);
  if (pedidosSection) {
    const sectionText = pedidosSection[0];
    const allCodes = sectionText.match(/\b(\d{5})\b/g);
    if (allCodes) {
      codigoMateria = [...new Set(allCodes)].join(', ');
    }
  }
  
  // Also try extracting first 5-digit code after materia names
  if (!codigoMateria) {
    const materiaNames = ['MODULO ELECTIVO', 'PRESCRIPCION', 'USO DEL CANNABIS', 'PARASITOSIS', 'ALERGIA', 'CARDIOLOGIA', 'CONSUMOS', 'EMERGENTOLOGIA', 'ENDOCRINOLOGIA', 'INFECTOLOGIA', 'MEDICINA LEGAL', 'NEUROCIENCIA', 'NEUROLOGIA', 'TERAPIA', 'TOPICOS', 'ECONOMIA', 'TRAUMA', 'SALUD AMBIENTAL', 'SALUD COMUNITARIA', 'TELESALUD'];
    const codes: string[] = [];
    for (const name of materiaNames) {
      const regex = new RegExp(name + '\\s+(\d{5})', 'gi');
      const matches = text.match(regex);
      if (matches) {
        for (const m of matches) {
          const found = m.match(/(\d{5})/);
          if (found) codes.push(found[1]);
        }
      }
    }
    if (codes.length > 0) {
      codigoMateria = [...new Set(codes)].join(', ');
    }
  }

  // === Extract Genéricas ===
  const genericas: string[] = [];
  let genRegex = /Mat\. Gen[eé]rica:[^)]*\(\s*(\d{5})\s*\)/gi;
  let match;
  while ((match = genRegex.exec(text)) !== null) {
    if (!genericas.includes(match[1])) genericas.push(match[1]);
  }
  if (genericas.length === 0) {
    genRegex = /Gen[eé]rica[^)]*\(\s*(\d{5})\s*\)/gi;
    while ((match = genRegex.exec(text)) !== null) {
      if (!genericas.includes(match[1])) genericas.push(match[1]);
    }
  }

  const genericaAsociada = genericas.join(', ');

  return { apellidoNombre, lu, codigoCarrera, plan, codigoMateria, genericaAsociada };
}