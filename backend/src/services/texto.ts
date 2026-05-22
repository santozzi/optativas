export interface Datos {
  lu: string;
  inscripcion: string;
  nombre: string;
  documento: string;
  carrera: string;
  plan: string;
  orientacion: string;
}

export const procesarDatos = (texto: string): Datos => {
  const regex = /L\.?U\.?:\s*(?<lu>.+)\r?\n\s*Nro\.?\s*de\s*Inscripción:\s*(?<inscripcion>.+)\r?\n\s*Apellido\s+y\s+Nombre:\s*(?<nombre>.+)\r?\n\s*Tipo\s+y\s+Nro\.?\s*de\s*Documento:\s*(?<documento>.+)\r?\n\s*Carrera:\s*(?<carrera>.+)\r?\n\s*Plan:\s*(?<plan>.+)\r?\n\s*Orientación:\s*(?<orientacion>.+)/;

  const match = texto.match(regex);
  if (!match?.groups) {
    throw new Error('No se encontraron datos en el PDF');
  }

  const { lu, inscripcion, nombre, documento, carrera, plan, orientacion } = match.groups;
  return { lu: lu?.trim() || '', inscripcion: inscripcion?.trim() || '', nombre: nombre?.trim() || '', documento: documento?.trim() || '', carrera: carrera?.trim() || '', plan: plan?.trim() || '', orientacion: orientacion?.trim() || '' };
};

export interface RawMateriaOptativa {
  materia: string;
  codigo: string;
  fechaPedido: string;
  plan: string;
}

export const procesarPedidoOptativas = (texto: string): RawMateriaOptativa[] => {
  // Maneja "Pedidos" (pdftotext) y "Pedido" (OCR)
  const regexTabla = /Pedidos? de Optativas Vigentes([\s\S]*?)COMPLETAR los campos con TODAS las materias elegidas/i;
  const match = texto.match(regexTabla);
  if (!match) return [];

  const bloque = match[1];

  // ── Intento 1: formato pdftotext normal (líneas separadas por campo) ──
  const lineas = bloque.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  const filtered = lineas.filter(l =>
    l &&
    !/^(Materia|C[oó]digo|Fecha Pedido|Plan)$/i.test(l) &&
    !/^C[oó]digo\s+Fecha\s+Pedido\s+Plan$/i.test(l)
  );
  const resultado: RawMateriaOptativa[] = [];

  const isDate = (value: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(value);
  const isCode = (value: string) => /^\d{4,6}$/.test(value);
  const isPlan = (value: string) => /^20\d{2}(?:\s*\/\s*\d+)?$/.test(value);

  // Microsoft Print to PDF suele dejar cada celda en una línea:
  // materia, código, fecha pedido, plan.
  const microsoftRows: RawMateriaOptativa[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const materia = filtered[i];
    const codigo = filtered[i + 1];
    const fechaPedido = filtered[i + 2];
    const plan = filtered[i + 3];

    if (materia && codigo && fechaPedido && isCode(codigo) && isDate(fechaPedido)) {
      microsoftRows.push({
        materia,
        codigo,
        fechaPedido,
        plan: plan && isPlan(plan) ? plan : '',
      });
      i += plan && isPlan(plan) ? 3 : 2;
    }
  }
  if (microsoftRows.length > 0) return microsoftRows;

  if (filtered.length >= 3) {
    // Grupo de a 3 (materia, codigo, fechaPedido) — líneas intermedias vacías se descartan
    let i = 0;
    while (i + 2 < filtered.length) {
      const materia = filtered[i] || '';
      const codigo = filtered[i + 1] || '';
      const fechaPedido = filtered[i + 2] || '';
      // Solo agregar si la materia y al menos uno de codigo o fecha tiene contenido
      if (materia && (codigo || fechaPedido)) {
        resultado.push({ materia, codigo, fechaPedido, plan: '' });
      }
      i += 3;
    }
    if (resultado.length > 0) return resultado;
  }

  // Si no hay al menos 3 líneas, fallback al intento 2

  // ── Intento 2: fallback OCR — parse por fecha en cada línea ──
  const skipHeaders = new Set([
    'Materia', 'Código', 'Fecha Pedido', 'Plan',
    'Pedidos de Optativas Vigentes', 'Pedido de Optativas Vigentes',
  ]);

  for (const linea of lineas) {
    if (skipHeaders.has(linea)) continue;
    if (/^(Materia|Código|Fecha|Pedido|Periodo|Plan)$/i.test(linea)) continue;

    const fechaMatch = linea.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!fechaMatch) continue;

    const fechaIdx = linea.indexOf(fechaMatch[1]);
    const fecha = fechaMatch[1];

    const despuesFecha = linea.substring(fechaIdx + fechaMatch[1].length).trim();
    const planMatch = despuesFecha.match(/^(20\d{2})/);
    const plan = planMatch ? planMatch[1] : '';

    const antesFecha = linea.substring(0, fechaIdx).trim();
    const codigoMatch = antesFecha.match(/(\d{5})/);
    let nombre = '';
    let codigo = '';

    if (codigoMatch) {
      const codigoIdx = antesFecha.indexOf(codigoMatch[1]);
      nombre = antesFecha.substring(0, codigoIdx).trim();
      nombre = nombre.replace(/\s+[a-z]$/i, '').trim();
      codigo = codigoMatch[1];
    } else {
      nombre = antesFecha.replace(/\s+[a-z]$/i, '').trim();
      codigo = '';
    }

    if (!nombre) continue;
    resultado.push({ materia: nombre, codigo, fechaPedido: fecha, plan });
  }

  // ── Intento 3: cada línea del bloque tiene "MATERIA FECHA" o "MATERIA CODIGO FECHA" ──
  // Agrupa tokens no vacíos de a 3 (materia, codigo, fecha) sin importar saltos de línea
  if (resultado.length === 0) {
    const tokens = bloque.split(/\r?\n/).map(l => l.trim()).filter(l => l && !skipHeaders.has(l));
    const parsed: RawMateriaOptativa[] = [];
    let i = 0;
    while (i + 2 < tokens.length) {
      const tok1 = tokens[i];
      const tok2 = tokens[i + 1];
      const tok3 = tokens[i + 2];
      // Si tok2 parece un código (5 dígitos) o fecha, o está vacío → ok
      if (tok1 && tok3.match(/\d{2}\/\d{2}\/\d{4}/)) {
        // Buscar plan después de la fecha en tok3
        const fechaMatch3 = tok3.match(/(\d{2}\/\d{2}\/\d{4})/);
        const fechaIdx3 = fechaMatch3 ? tok3.indexOf(fechaMatch3[1]) : -1;
        const plan = fechaMatch3
          ? tok3.substring(fechaIdx3 + fechaMatch3[1].length).trim().match(/^(20\d{2})/)?.[1] || ''
          : '';
        parsed.push({ materia: tok1, codigo: tok2 || '', fechaPedido: fechaMatch3 ? fechaMatch3[1] : tok3, plan });
      }
      i += 3;
    }
    if (parsed.length > 0) return parsed;
  }

  return resultado;
};

export interface RawGenerica {
  código: string;
  tipo: string;
  carrera: string;
  plan: number;
  materia?: { nombre: string; código: string };
}

export interface RawAnual {
  año: number;
  periodoLectivo: string;
  generica: RawGenerica[];
}

export const matriasGenericas = (texto: string): RawAnual[] => {
  const regex = /COMPLETAR los campos con TODAS las materias elegidas([\s\S]*?)(?:Materias optativas del plan ofrecidas para el período lectivo actual|$)/i;
  const match = texto.match(regex);
  if (!match) return [];

  const lineas = match[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const anuales: RawAnual[] = [];
  let bloqueActual: RawAnual | null = null;
  let genericaActual: RawGenerica | null = null;
  let inferredYear = 3;

  const normalizeGenericCode = (codigo: string) => {
    const clean = codigo.trim().toUpperCase();
    const ocrG = clean.match(/^6(\d{4})$/);
    return ocrG ? `G${ocrG[1]}` : clean;
  };

  const startBlockIfMissing = () => {
    if (!bloqueActual) {
      bloqueActual = { año: inferredYear, periodoLectivo: '', generica: [] };
    }
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    if (linea.startsWith('Año:')) {
      if (bloqueActual) anuales.push(bloqueActual);
      const año = parseInt(linea.replace('Año:', '').trim()) || inferredYear;
      bloqueActual = { año, periodoLectivo: '', generica: [] };
      inferredYear = año >= 6 ? año + 1 : 6;
      continue;
    }

    if (linea.startsWith('Periodo Lectivo:')) {
      if (bloqueActual && bloqueActual.generica.length > 0) {
        anuales.push(bloqueActual);
        bloqueActual = { año: inferredYear, periodoLectivo: '', generica: [] };
        inferredYear = inferredYear >= 6 ? inferredYear + 1 : 6;
      }
      startBlockIfMissing();
      if (bloqueActual) bloqueActual.periodoLectivo = linea.replace('Periodo Lectivo:', '').trim();
      continue;
    }

    if (/Gen[eé]rica:/i.test(linea)) {
      startBlockIfMissing();
      const parte = linea.replace(/^.*?Gen[eé]rica:/i, '').trim();
      const gm = parte.match(/^([A-Z0-9]+)\s*-\s*(.+?),\s*(plan\s*\d+.*?)\s*$/i);
      if (gm) {
        const planNum = (gm[3] || '').match(/(\d+)/)?.[1] || '0';
        genericaActual = {
          código: normalizeGenericCode(gm[1]),
          tipo: gm[2].trim(),
          carrera: '',
          plan: parseInt(planNum),
        };
        if (bloqueActual) bloqueActual.generica.push(genericaActual);
      }
      continue;
    }

    if (linea.startsWith('Puntos Requeridos:')) {
      const puntos = lineas[i + 1];
      if (genericaActual && /^\d+$/.test(puntos)) {
        (genericaActual as any).puntosRequeridos = parseInt(puntos);
      }
      continue;
    }

    const cleanLine = linea.replace(/\s+v\s*$/, '');
    const materiaMatch = cleanLine.match(/^(.*?)\s*\((\d+)\)\s*[^A-Za-z0-9]*$/);
    if (materiaMatch && genericaActual) {
      genericaActual.materia = { nombre: materiaMatch[1].trim(), código: materiaMatch[2] };
      continue;
    }

    if (
      genericaActual &&
      !genericaActual.materia &&
      /[A-ZÁÉÍÓÚÑ]/.test(cleanLine) &&
      !/^Puntos Requeridos:/i.test(cleanLine) &&
      !/^\d+$/.test(cleanLine)
    ) {
      genericaActual.materia = { nombre: cleanLine.trim(), código: '' };
    }
  }

  if (bloqueActual) anuales.push(bloqueActual);
  return anuales;
};
