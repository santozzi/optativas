"""
Capa 3 — Parsing de texto limpio a JSON.
Adaptado a la estructura real de los PDFs de la UNS (Chrome/Safari).
"""

import re
from dataclasses import dataclass, field


@dataclass
class HeaderData:
    lu: str = ''
    inscripcion: str = ''
    nombre: str = ''
    documento: str = ''
    carrera: str = ''
    plan: str = ''
    orientacion: str = ''


@dataclass
class MateriaOptativa:
    materia: str = ''
    codigo: str = ''
    fecha_pedido: str = ''
    plan: str = ''


@dataclass
class GenericaItem:
    codigo: str = ''
    tipo: str = ''
    materia_nombre: str = ''
    materia_codigo: str = ''


@dataclass
class AnualData:
    anio: int = 0
    periodo_lectivo: str = ''
    generica: list = field(default_factory=list)


@dataclass
class ParsedPDF:
    raw_text: str = ''
    header: HeaderData = field(default_factory=HeaderData)
    materias_optativas: list = field(default_factory=list)
    anuales: list = field(default_factory=list)
    raw_pages: int = 0
    ok: bool = False
    errors: list = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# Header — campos en líneas separadas
# ──────────────────────────────────────────────────────────────────────────────

def parse_header(text: str) -> HeaderData:
    h = HeaderData()
    lines = text.split('\n')

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        upper = line.upper()

        # LU — puede estar en la misma línea "LU: 20506060076" o en líneas separadas
        if re.match(r'^LU[\s.:]*\d', line, re.IGNORECASE) or upper == 'LU':
            if ':' in line:
                m = re.search(r':\s*(.+)', line)
                if m: h.lu = re.sub(r'\D', '', m.group(1).strip())
            elif i + 1 < len(lines):
                sig = lines[i + 1].strip()
                h.lu = re.sub(r'\D', '', sig)
        # Inscripción
        elif re.match(r'^Nro\.?\s*de\s*inscripci', line, re.IGNORECASE):
            m = re.search(r':\s*(.+)', line)
            if m: h.inscripcion = m.group(1).strip()
        # ApellidoyNombre — puede estar solo en su línea o con el nombre en la misma
        # Caso: "ApellidoyNombre MARTINEZ, CAMILA" o "ApellidoyNombre\nMARTINEZ, CAMILA"
        elif 'APELLIDO' in upper and 'NOMBRE' in upper:
            if i + 1 < len(lines):
                sig = lines[i + 1].strip()
                if sig:
                    h.nombre = sig[:100]
                    break
            #，也可能同名在一行
            rest = re.sub(r'^[^:]+:\s*', '', line).strip()
            if rest and len(rest) > 2:
                h.nombre = rest[:100]
        # Documento
        elif re.match(r'^Tipo\s+y\s+Nro\.?\s*de\s*Documento', line, re.IGNORECASE):
            m = re.search(r':\s*(.+)', line)
            if m: h.documento = m.group(1).strip()
        elif upper == 'DNI':
            m = re.search(r':\s*(.+)', line)
            if m: h.documento = m.group(1).strip()
        # Carrera — formato: "(20053) Tecnicatura..."
        elif re.match(r'^\(?\d{5}\)?\s*Carrera', line, re.IGNORECASE):
            val = re.sub(r'^\(?\d{5}\)?\s*', '', line).strip()
            val = re.sub(r'\s*Plan:.*', '', val).strip()
            h.carrera = val
        # Plan — formato: "Plan: 2023/2"
        elif re.match(r'^Plan[\s.:]*\d', line, re.IGNORECASE):
            m = re.search(r'Plan[\s.:]*(\S+)', line)
            if m: h.plan = m.group(1).strip()
        # Orientación
        elif re.match(r'^Orientaci', line, re.IGNORECASE):
            val = re.sub(r'^Orientaci[oó]n[:.\s]*', '', line, flags=re.IGNORECASE).strip()
            h.orientacion = val

    return h


# ──────────────────────────────────────────────────────────────────────────────
# Optativas pedidas
# ──────────────────────────────────────────────────────────────────────────────

def parse_optativas(text: str) -> list[MateriaOptativa]:
    """
    Busca el bloque de optativas y extrae líneas de la forma:
      MATERIA  20073  10/03/2025  2025
    donde 20073 = código, 10/03/2025 = fecha, 2025 = plan.
    """
    optativas = []

    start = re.search(r'Pedidos\s*(?:de\s*)?Optativas\s*Vigentes', text, re.IGNORECASE)
    if not start:
        return optativas

    end = re.search(r'COMPLETAR', text, re.IGNORECASE)
    block = text[start.start():end.start() if end else len(text)]

    # Por cada línea: buscar código (5 dígitos) + fecha + año de plan
    for line in block.split('\n'):
        line = line.strip()
        if not line:
            continue

        # Buscar código de materia (5 dígitos)
        code_m = re.search(r'(\d{5})\b', line)
        if not code_m:
            continue

        codigo = code_m.group(1)

        # Buscar fecha en formato dd/dd/dddd
        date_m = re.search(r'(\d{2}/\d{2}/\d{4})', line)
        if not date_m:
            continue

        fecha = date_m.group(1)

        # Buscar año del plan (4 dígitos empezando en 20)
        plan_m = re.search(r'\b(20\d{2})\b', line)
        plan = plan_m.group(1) if plan_m else ''

        # Materia = todo lo anterior al código, limpiado
        before_code = line[:code_m.start()].strip()
        # Limpiar residuos de código pegado
        materia = re.sub(r'\s+\d{5}\s*$', '', before_code).strip()
        materia = re.sub(r'\s{2,}', ' ', materia).strip()

        if materia and len(materia) > 2:
            optativas.append(MateriaOptativa(
                materia=materia,
                codigo=codigo,
                fecha_pedido=fecha,
                plan=plan,
            ))

    return optativas


# ──────────────────────────────────────────────────────────────────────────────
# COMPLETAR block
# ──────────────────────────────────────────────────────────────────────────────

def parse_completar(text: str) -> list[AnualData]:
    """
    Busca bloques "Año: N" con "Periodo Lectivo: N" y "Mat. Genérica: CÓDIGO - TIPO".
    Cada bloque corresponde a un año lectivo.
    """
    anuales: list[AnualData] = []
    block_start = re.search(r'COMPLETAR', text, re.IGNORECASE)
    if not block_start:
        return anuales

    block = text[block_start.start():]

    # Dividir en bloques por cada "Año:"
    year_pattern = re.compile(r'^Año:\s*(\d+)', re.MULTILINE)

    for anio_m in year_pattern.finditer(block):
        anio = int(anio_m.group(1))
        anio_start = anio_m.start()

        # Delimitar bloque hasta próximo "Año:" o fin
        rest = block[anio_start + len(anio_m.group(0)):]
        next_anio = year_pattern.search(rest)
        year_block = rest[:next_anio.start() if next_anio else len(rest)]

        # Periodo Lectivo
        periodo_m = re.search(r'Periodo\s*Lectivo[:\s]*(\S+)', year_block, re.IGNORECASE)
        periodo = periodo_m.group(1).strip() if periodo_m else ''

        current = AnualData(anio=anio, periodo_lectivo=periodo)

        # Buscar todas las Mat. Genéricas en este bloque
        for gen_m in re.finditer(
            r'Mat\.\s*Gen[eé]rica:\s*([A-Z0-9]+)\s*-\s*([^\n]+)',
            year_block, re.IGNORECASE
        ):
            codigo = gen_m.group(1).strip()
            tipo = gen_m.group(2).strip()

            # Buscar materia en las siguientes líneas (puede estar 1-3 líneas después)
            gen_end = gen_m.end()
            after_gen = year_block[gen_end:gen_end + 300]
            mat_m = re.search(r'([A-ZÁÉÍÓÚÑÜ][A-Za-záéíóúñü\s,]+?)\s*\((\d{5})\)', after_gen, re.DOTALL)

            generica = GenericaItem(
                codigo=codigo,
                tipo=tipo,
                materia_nombre=mat_m.group(1).strip() if mat_m else '',
                materia_codigo=mat_m.group(2) if mat_m else '',
            )
            current.generica.append(generica)

        anuales.append(current)

    return anuales


# ──────────────────────────────────────────────────────────────────────────────
# Orchestrator
# ──────────────────────────────────────────────────────────────────────────────

def parse_pdf_text(text: str, num_pages: int) -> ParsedPDF:
    result = ParsedPDF(raw_pages=num_pages)
    errors = []

    try:
        result.header = parse_header(text)
        result.materias_optativas = parse_optativas(text)
        result.anuales = parse_completar(text)
        result.ok = True
    except Exception as e:
        errors.append(str(e))

    result.errors = errors
    return result