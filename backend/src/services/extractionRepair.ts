import type { Anual, MateriaOptativa } from './ocr';

interface RepairInput {
  plan: string;
  materias: MateriaOptativa[];
  anuales: Anual[];
  rawText: string;
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ñ/g, 'N')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();
}

function getPlanYear(plan: string) {
  return plan.match(/20\d{2}/)?.[0] || '';
}

function fillMissingPlans(materias: MateriaOptativa[], planYear: string) {
  if (!planYear) return;
  for (const materia of materias) {
    if (!materia.plan) materia.plan = planYear;
  }
}

function fillMissingGenericSubjectCodes(materias: MateriaOptativa[], anuales: Anual[]) {
  const materiasByName = new Map<string, MateriaOptativa>();
  for (const materia of materias) {
    materiasByName.set(normalizeName(materia.materia), materia);
  }

  for (const anual of anuales) {
    for (const generica of anual.generica) {
      if (!generica.materia || generica.materia.código) continue;

      const genericName = normalizeName(generica.materia.nombre);
      const match = [...materiasByName.values()].find(materia => {
        const materiaName = normalizeName(materia.materia);
        return materiaName === genericName || materiaName.startsWith(genericName) || genericName.startsWith(materiaName);
      });

      if (match) generica.materia.código = match.codigo;
    }
  }
}

function hasInvalidRequestedSubjects(materias: MateriaOptativa[]) {
  return materias.length > 0 && materias.some(materia =>
    !/^\d{4,6}$/.test(materia.codigo) || !/^\d{2}\/\d{2}\/\d{4}$/.test(materia.fechaPedido)
  );
}

function extractDatePlanByCode(rawText: string, defaultPlan: string) {
  const datePlanByCode = new Map<string, { fechaPedido: string; plan: string }>();
  const codeDateRegex = /(\d{4,6})\s*\n+\s*(\d{2}\/\d{2}\/\d{4})(?:\s+((?:20)?\d{2,4}))?/g;

  for (const match of rawText.matchAll(codeDateRegex)) {
    const plan = match[3] && /^20\d{2}$/.test(match[3]) ? match[3] : defaultPlan;
    datePlanByCode.set(match[1], { fechaPedido: match[2], plan: plan || '' });
  }

  return datePlanByCode;
}

function extractDatePlanByName(rawText: string, defaultPlan: string) {
  const datePlanByName = new Map<string, { fechaPedido: string; plan: string }>();
  const block = rawText.match(/Pedidos? de Optativas Vigentes([\s\S]*?)COMPLETAR los campos con TODAS las materias elegidas/i)?.[1] || '';
  const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})(?:\s+((?:20)?\d{2,4}))?/);
    if (!dateMatch) continue;

    const beforeDate = line.slice(0, dateMatch.index).trim();
    const subjectName = beforeDate
      .replace(/\b\d{4,6}\b/g, '')
      .replace(/\bm\b/gi, '')
      .trim();

    if (!subjectName) continue;

    const plan = dateMatch[2] && /^20\d{2}$/.test(dateMatch[2]) ? dateMatch[2] : defaultPlan;
    datePlanByName.set(normalizeName(subjectName), { fechaPedido: dateMatch[1], plan: plan || '' });
  }

  return datePlanByName;
}

function repairRequestedSubjectsFromGenerics(input: RepairInput, planYear: string) {
  if (!hasInvalidRequestedSubjects(input.materias)) return;

  const fallbackGenericas = input.anuales
    .filter(a => a.año !== 6)
    .flatMap(a => a.generica)
    .filter(g => g.materia?.nombre && g.materia?.código);

  if (fallbackGenericas.length === 0) return;

  const datePlanByCode = extractDatePlanByCode(input.rawText, planYear);
  const datePlanByName = extractDatePlanByName(input.rawText, planYear);
  input.materias.splice(0, input.materias.length, ...fallbackGenericas.map(g => {
    const codigo = g.materia?.código || '';
    const datePlan = datePlanByCode.get(codigo) || datePlanByName.get(normalizeName(g.materia?.nombre || ''));

    return {
      materia: g.materia?.nombre || '',
      codigo,
      fechaPedido: datePlan?.fechaPedido || '',
      plan: datePlan?.plan || planYear,
    };
  }));
}

export function repairExtraction(input: RepairInput) {
  const planYear = getPlanYear(input.plan);

  fillMissingPlans(input.materias, planYear);
  fillMissingGenericSubjectCodes(input.materias, input.anuales);
  repairRequestedSubjectsFromGenerics(input, planYear);
}
