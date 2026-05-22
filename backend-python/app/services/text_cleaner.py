"""
Capa 2 — Limpieza de texto crudo.
Normaliza saltos de línea problemáticos, pero preserva la estructura del PDF.
"""

import re


def clean_text(raw: str) -> str:
    """
    Limpia el texto extraído para facilitar el parsing.

    PROBLEMA: Los PDFs multilínea rompen campos en varias líneas, ej:
      "PARASITOSIS EMERGENTES,\nRE-EMERGENTES Y ARTROPODOLOGIA MEDICA"
      → hay que unir líneas que fueron cortadas en el medio de una palabra
        o que siguen en la siguiente línea (continuación de materia).

    ESTRATEGIA:
      1. Reemplazar saltos de línea en medio de palabras (uppercase-next-line)
         por un espacio (línea cortada manualmente en el PDF).
      2. Normalizar retornos de carro Windows.
      3. Reducir saltos múltiples a saltos simples.
      4. Limpiar espacios horizontales sobrantes.
      5. NO eliminar líneas en blanco individuales — son separadores naturales.
    """
    # Windows → Unix
    text = raw.replace('\r', '')

    # Unir líneas cortadas:
    # Si una línea termina con texto en mayúscula seguido de salto + línea
    # que empieza en mayúscula → es una continuación, unir con espacio.
    # Patrón: línea的最后word ends with uppercase + newline + siguiente starts uppercase
    # Lo hago con un loop porque puede haber encadenamiento
    prev = ''
    MAX_PASSES = 5
    for _ in range(MAX_PASSES):
        new_text = re.sub(
            r'([A-ZÁÉÍÓÚÑÜ])\n([A-ZÁÉÍÓÚÑÜ(])',
            r'\1 \2',
            text
        )
        if new_text == text:
            break
        text = new_text

    # Si una línea tiene solo una palabra corta al final (< 4chars),
    # probablemente fue cortada — unir con la siguiente
    # Ej: "ALERGIA E INMUNOLOGIA 20153 DCS-\nBAHIA" → unir
    text = re.sub(r'([a-zA-Z0-9])\n([A-Z])', r'\1 \2', text)

    # Normalizar saltos múltiples → salto simple
    text = re.sub(r'\n{3,}', '\n', text)

    # Limpiar espacios horizontales
    text = re.sub(r'[ \t]+', ' ', text)

    # Eliminar líneas vacías al principio y final
    text = text.strip()

    return text


def split_pages(text: str) -> list[str]:
    """Divide en páginas por el separador de página."""
    pages = re.split(r'\n{2,}', text)
    return [p.strip() for p in pages if p.strip()]