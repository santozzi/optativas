"""
Servicio PDF — ORCHESTRATOR.
Coordina las 3 capas: extracción → limpieza → parsing.
"""

import os
import re
from .pdf_extractor import extract_all_pages, extract_full_text
from .text_cleaner import clean_text
from .pdf_parser import parse_pdf_text, ParsedPDF
from .pdf_ocr import ocr_pdf


def process_pdf(pdf_path: str) -> ParsedPDF:
    """
    Pipeline completo:
      1. Detectar fuente      → si es Edge/PrintToPDF, va directo a OCR
      2. Extracción          → texto por página (pdfplumber)
      3. Fallback OCR         → si el texto está vacío o faltan campos clave
      4. Limpieza             → texto normalizado
      5. Parsing              → JSON con campos estructurados
    """
    from .pdf_metadata import get_pdf_metadata

    # ── Fuente: Print To PDF (Edge) → OCR directo ──
    try:
        meta = get_pdf_metadata(pdf_path)
        is_print_to_pdf = 'Print To PDF' in meta.get('producer', '')
    except Exception:
        is_print_to_pdf = False

    raw = ''
    num_pages = 1

    if not is_print_to_pdf:
        # ── Capa 1: extraer con pdfplumber ──
        pages = extract_all_pages(pdf_path)
        raw = '\n\n'.join(p.raw_text for p in pages)
        num_pages = len(pages)

        # ── Fallback OCR: si el texto está vacío o faltan campos clave ──
        has_lu = bool(re.search(r'L\.?U\.?:', raw, re.IGNORECASE))
        has_plan = bool(re.search(r'Plan:', raw, re.IGNORECASE))
        text_ok = len(raw) > 30 and has_lu and has_plan

        if not text_ok:
            print(f'[process_pdf] text insufficient (len={len(raw)}, LU={has_lu}, Plan={has_plan}), running OCR...')
            try:
                raw = ocr_pdf(pdf_path)
                print(f'[process_pdf] OCR result: {len(raw)} chars')
            except Exception as e:
                print(f'[process_pdf] OCR error:', e)
    else:
        # ── Print To PDF → OCR directo ──
        print(f'[process_pdf] source=PrintToPDF, running OCR directly...')
        try:
            raw = ocr_pdf(pdf_path)
            print(f'[process_pdf] OCR result: {len(raw)} chars')
        except Exception as e:
            print(f'[process_pdf] OCR error:', e)
            raw = ''

        # Contar páginas con PyMuPDF
        try:
            import fitz
            doc = fitz.open(pdf_path)
            num_pages = len(doc)
            doc.close()
        except Exception:
            num_pages = 1

    # ── Capa 2: limpiar ──
    cleaned = clean_text(raw)

    # ── Capa 3: parsear ──
    result = parse_pdf_text(cleaned, num_pages)
    result.raw_text = raw  # guardar texto crudo para debug
    return result


def extract_for_debug(pdf_path: str) -> dict:
    """
    Version verbose para debug — devuelve info de cada capa.
    """
    pages = extract_all_pages(pdf_path)
    raw = '\n\n'.join(p.raw_text for p in pages)
    cleaned = clean_text(raw)
    parsed = parse_pdf_text(cleaned, len(pages))

    return {
        'pages': len(pages),
        'extraction': {
            'raw_char_count': len(raw),
            'sample_raw': raw[:300],
        },
        'cleaning': {
            'cleaned_char_count': len(cleaned),
            'sample_cleaned': cleaned[:300],
        },
        'parsed': {
            'ok': parsed.ok,
            'header': {
                'lu': parsed.header.lu,
                'nombre': parsed.header.nombre,
                'documento': parsed.header.documento,
                'inscripcion': parsed.header.inscripcion,
                'carrera': parsed.header.carrera,
                'plan': parsed.header.plan,
                'orientacion': parsed.header.orientacion,
            },
            'materias_optativas': [
                {
                    'materia': m.materia,
                    'codigo': m.codigo,
                    'fecha_pedido': m.fecha_pedido,
                    'plan': m.plan,
                } for m in parsed.materias_optativas
            ],
            'anuales': [
                {
                    'anio': a.anio,
                    'periodo_lectivo': a.periodo_lectivo,
                    'generica': [
                        {
                            'codigo': g.codigo,
                            'tipo': g.tipo,
                            'materia_nombre': g.materia_nombre,
                            'materia_codigo': g.materia_codigo,
                        } for g in a.generica
                    ],
                } for a in parsed.anuales
            ],
            'errors': parsed.errors,
        },
    }


def compare_libraries(pdf_path: str) -> dict:
    """
    Comparativa de extracción de texto con las 4 librerías.
    """
    results = {}

    # pdfplumber
    try:
        pages = extract_all_pages(pdf_path)
        raw = '\n\n'.join(p.raw_text for p in pages)
        results['PDFplumber'] = {'success': True, 'pages': len(pages), 'chars': len(raw), 'sample': raw[:200]}
    except Exception as e:
        results['PDFplumber'] = {'success': False, 'error': str(e)}

    # PyMuPDF
    try:
        import fitz
        doc = fitz.open(pdf_path)
        parts = [p.get_text() for p in doc]
        doc.close()
        raw = '\n\n'.join(parts)
        results['PyMuPDF'] = {'success': True, 'pages': len(parts), 'chars': len(raw), 'sample': raw[:200]}
    except Exception as e:
        results['PyMuPDF'] = {'success': False, 'error': str(e)}

    # PyPDF2
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        parts = [p.extract_text() or '' for p in reader.pages]
        raw = '\n\n'.join(parts)
        results['PyPDF2'] = {'success': True, 'pages': len(parts), 'chars': len(raw), 'sample': raw[:200]}
    except Exception as e:
        results['PyPDF2'] = {'success': False, 'error': str(e)}

    # pdfminer.six
    try:
        from pdfminer import high_level
        with open(pdf_path, 'rb') as f:
            raw = high_level.extract_text(f)
        results['pdfminer.six'] = {'success': True, 'pages': -1, 'chars': len(raw), 'sample': raw[:200]}
    except Exception as e:
        results['pdfminer.six'] = {'success': False, 'error': str(e)}

    return results