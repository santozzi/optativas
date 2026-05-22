"""
Servicio de extracción de tablas con tabula-py (Java backend).
Útil para PDFs nativos con tablas estructuradas (Chrome/Safari).
"""

import tabula
import pandas as pd


def extract_tables(pdf_path: str, pages='all') -> list[pd.DataFrame]:
    """
    Extrae todas las tablas detectadas en un PDF con tabula-py.
    Retorna lista de DataFrames.
    """
    try:
        tables = tabula.read_pdf(
            pdf_path,
            pages=pages,
            java_options=['-Djava.awt.headless=true'],
            guess=True,
            silent=True,
        )
        return [t for t in tables if t is not None and not t.empty]
    except Exception as e:
        print(f'[tabula] error: {e}')
        return []


def tables_to_text(tables: list[pd.DataFrame]) -> str:
    """
    Convierte las tablas extraídas a texto legible para el parser.
    """
    lines = []
    for i, t in enumerate(tables):
        # Limpiar NaNs
        t_clean = t.fillna('')
        for _, row in t_clean.iterrows():
            vals = [str(v).strip() for v in row.values if str(v).strip()]
            if vals:
                lines.append(' | '.join(vals))
    return '\n'.join(lines)