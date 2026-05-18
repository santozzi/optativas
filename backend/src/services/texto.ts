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
  const regex = /L\.?U\.?:\s*(?<lu>.+)\r?\n\s*Nro\.?\s*de\s*Inscripción:\s*(?<inscripcion>.+)\r?\n\s*Apellido\s+y\s+Nombre:\s*(?<nombre>.+)\r?\n\s*Tipo\s+y\s+Nro\.?\s*de\s+Documento:\s*(?<documento>.+)\r?\n\s*Carrera:\s*(?<carrera>.+)\r?\n\s*Plan:\s*(?<plan>.+)\r?\n\s*Orientación:\s*(?<orientacion>.+)/;

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

  // — Formato OCR: todo en una sola línea —
  // "MODULO ELECTIVO 20070 06/11/2025 2023" (espacios simples entre campos)
  const lineas = bloque.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (lineas.length === 1) {
    const singleLine = lineas[0];
    // Si la línea tiene exactamente un código (5 dígitos), una fecha (dd/mm/yyyy)
    // y un plan (4 dígitos) → parsear
    const codigoMatch = singleLine.match(/(\d{5})/);
    const fechaMatch = singleLine.match(/(\d{2}\/\d{2}\/\d{4})/);
    const planMatch = singleLine.match(/\b(20\d{2})\b(?!.*\d{5})/); // plan al final
    if (codigoMatch && fechaMatch) {
      const nombre = singleLine.substring(0, singleLine.indexOf(codigoMatch[1])).trim();
      const codigo = codigoMatch[1];
      const fecha = fechaMatch[1];
      // Plan: todo lo que quede después de la fecha que sea un año tipo 20xx
      const despuesFecha = singleLine.substring(singleLine.indexOf(fechaMatch[1]) + fechaMatch[1].length).trim();
      const planMatch2 = despuesFecha.match(/^(20\d{2})/);
      const plan = planMatch2 ? planMatch2[1] : despuesFecha.replace(/\D/g, '').substring(0, 4);
      return [{ materia: nombre, codigo, fechaPedido: fecha, plan }];
    }
  }

  // — Formato normal pdftotext: una línea por campo —
  const filtered = lineas.filter(l =>
    l && l !== 'Materia' && l !== 'Código' && l !== 'Fecha Pedido' && l !== 'Plan'
  );
  const resultado: RawMateriaOptativa[] = [];
  for (let i = 0; i + 3 < filtered.length; i += 4) {
    resultado.push({
      materia: filtered[i] || '',
      codigo: filtered[i + 1] || '',
      fechaPedido: filtered[i + 2] || '',
      plan: filtered[i + 3] || '',
    });
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
  const regex = /COMPLETAR los campos con TODAS las materias elegidas([\s\S]*?)Materias optativas del plan ofrecidas para el período lectivo actual/i;
  const match = texto.match(regex);
  if (!match) return [];

  const lineas = match[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const anuales: RawAnual[] = [];
  let bloqueActual: RawAnual | null = null;
  let genericaActual: RawGenerica | null = null;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    if (linea.startsWith('Año:')) {
      if (bloqueActual) anuales.push(bloqueActual);
      bloqueActual = { año: parseInt(linea.replace('Año:', '').trim()) || 0, periodoLectivo: '', generica: [] };
      continue;
    }

    if (linea.startsWith('Periodo Lectivo:')) {
      if (bloqueActual) bloqueActual.periodoLectivo = linea.replace('Periodo Lectivo:', '').trim();
      continue;
    }

    if (linea.startsWith('Mat. Genérica:')) {
      const parte = linea.replace('Mat. Genérica:', '').trim();
      // Formato flexible: "CODIGO - Descripción [, Carrera] [plan|Plan] NNNN [Puntos Requeridos: NNN]"
      // Ejemplos:
      //   "G0950 - Optativa de Medicina, plan 2023 Puntos Requeridos: 100"
      //   "GM001 - Módulo Electivo, Medicina, Plan 2023 Puntos Requeridos: 100"
      //   "60951 - Optativa de Medicina, plan 2023 Puntos Requeridos: 100"
      const gm = parte.match(/^([A-Z0-9]+)\s*-\s*(.+?),\s*(plan\s*\d+.*?)\s*$/i);
      if (gm) {
        const planNum = (gm[3] || '').match(/(\d+)/)?.[1] || '0';
        genericaActual = {
          código: gm[1],
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

    // Materia: "NOMBRE (codigo)" — limpiar "v" residual al final de línea
    const cleanLine = linea.replace(/\s+v\s*$/, '');
    const materiaMatch = cleanLine.match(/^(.*)\s*\((\d+)\)$/);
    if (materiaMatch && genericaActual) {
      genericaActual.materia = { nombre: materiaMatch[1].trim(), código: materiaMatch[2] };
    }
  }

  if (bloqueActual) anuales.push(bloqueActual);
  return anuales;
};