"""
Capa 1 — Extracción de texto crudo desde PDF usando pdfplumber.
Solo extrae, no limpia ni parsea.
"""

import pdfplumber
from dataclasses import dataclass


@dataclass
class PageText:
    page_num: int
    raw_text: str
    char_count: int
    tables: list  # tablas detectadas en la página


def extract_all_pages(pdf_path: str) -> list[PageText]:
    """
    Abre el PDF con pdfplumber y extrae texto + tablas de cada página.
    Retorna lista de PageText (una por página).
    """
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            raw = page.extract_text() or ''
            # Extraer tablas de la página
            table_list = []
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    if table:
                        table_list.append(table)

            pages.append(PageText(
                page_num=i,
                raw_text=raw,
                char_count=len(raw),
                tables=table_list,
            ))
    return pages


def extract_full_text(pdf_path: str) -> str:
    """Une el texto de todas las páginas."""
    pages = extract_all_pages(pdf_path)
    return '\n\n'.join(p.page_num.__repr__() + '\n' + p.raw_text for p in pages)