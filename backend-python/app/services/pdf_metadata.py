"""
Servicio de metadata de PDF — usa PyMuPDF.
"""

import fitz


def get_pdf_metadata(pdf_path: str) -> dict:
    """
    Extrae metadata completa de un PDF con PyMuPDF.
    """
    doc = fitz.open(pdf_path)
    meta = doc.metadata

    # Información de creator/producer
    producer = meta.get('producer', '')
    creator = meta.get('creator', '')

    # Intentar determinar navegador/aplicación
    browser = detect_browser(producer, creator)

    result = {
        'format': meta.get('format', ''),
        'title': meta.get('title', ''),
        'author': meta.get('author', ''),
        'subject': meta.get('subject', ''),
        'keywords': meta.get('keywords', ''),
        'creator': creator,
        'producer': producer,
        'creationDate': meta.get('creationDate', ''),
        'modDate': meta.get('modDate', ''),
        'browser': browser,
        'pages': len(doc),
        'is_encrypted': doc.is_encrypted,
    }
    doc.close()
    return result


def detect_browser(producer: str, creator: str) -> str:
    """Infiere el navegador o herramienta que generó el PDF."""
    p = producer.lower()
    c = creator.lower()

    if 'chrome' in p or 'chrome' in c:
        return 'Google Chrome'
    if 'edge' in p or 'msedge' in p or 'edge' in c:
        return 'Microsoft Edge'
    if 'firefox' in p or 'firefox' in c:
        return 'Mozilla Firefox'
    if 'safari' in p or 'safari' in c:
        return 'Safari'
    if 'print to pdf' in p or 'microsoft' in p:
        return 'Windows Print to PDF (Edge)'
    if 'wkhtmltopdf' in p:
        return 'wkhtmltopdf'
    if 'pdflib' in p or 'pdflib' in c:
        return 'PDFLib'
    if not producer and not creator:
        return 'Desconocido'
    return producer or creator or 'Desconocido'