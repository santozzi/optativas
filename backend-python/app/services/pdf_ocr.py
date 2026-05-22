"""
OCR fallback — se usa cuando pdfplumber/PyMuPDF no encuentran texto.
Renders pages to images with PyMuPDF y aplica OCR con pytesseract.
"""

import pytesseract
from PIL import Image
import fitz  # PyMuPDF
import io


def ocr_pdf(pdf_path: str, lang: str = 'spa') -> str:
    """
    Aplica OCR a todas las páginas de un PDF usando pytesseract.
    Usa PyMuPDF para renderizar cada página a imagen PNG (300 DPI).
    Retorna el texto OCR-leído.
    """
    doc = fitz.open(pdf_path)
    all_text = []

    for i, page in enumerate(doc):
        # Si pdfplumber/PyMuPDF ya tienen texto, no necesitamos OCR
        page_text = page.get_text()
        if page_text and page_text.strip():
            all_text.append(page_text)
            continue

        # Renderizar página a imagen (300 DPI)
        mat = fitz.Matrix(300 / 72, 300 / 72)
        pix = page.get_pixmap(matrix=mat)

        # PyMuPDF devuelve PNG en pix.samples como bytes raw RGBA
        img_data = pix.samples

        # Convertir a PIL Image
        img = Image.frombytes('RGB', [pix.width, pix.height], img_data, 'raw')

        # OCR
        try:
            text = pytesseract.image_to_string(img, lang=lang)
            if text.strip():
                all_text.append(f'[Página {i+1}]\n{text}')
        except Exception as e:
            print(f'[ocr_pdf] page {i+1} error:', e)

    doc.close()
    return '\n\n'.join(all_text)