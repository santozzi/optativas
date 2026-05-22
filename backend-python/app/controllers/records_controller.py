"""
Controlador completo de PDF Records — backed by PostgreSQL.
Reemplaza completamente la funcionalidad del backend Node.js.
"""

import os
import uuid
import json
from flask import request, jsonify, send_file
from werkzeug.utils import secure_filename
from ..services import pdf_service
from ..services.migrate import migrate_all
from ..models.pdf_record import PdfRecord, get_session


ALLOWED_EXTENSIONS = {'pdf'}


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _get_upload_path(filename: str) -> str:
    from app.config import Config
    return os.path.join(Config.UPLOAD_FOLDER, filename)


def _get_raw_text(pdf_path: str) -> str:
    """
    Extrae texto crudo (sin limpieza ni parsing) de un PDF.
    Usa pdfplumber + PyMuPDF como fallback.
    """
    import fitz
    import pdfplumber

    # Probar pdfplumber primero
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages = [p.extract_text() or '' for p in pdf.pages]
            raw = '\n'.join(pages)
            if raw.strip():
                return raw
    except Exception:
        pass

    # Fallback PyMuPDF
    try:
        doc = fitz.open(pdf_path)
        pages = [p.get_text() for p in doc]
        doc.close()
        raw = '\n'.join(pages)
        if raw.strip():
            return raw
    except Exception:
        pass

    # Fallback OCR
    try:
        from ..services.pdf_ocr import ocr_pdf
        return ocr_pdf(pdf_path)
    except Exception:
        return ''


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/records
# ──────────────────────────────────────────────────────────────────────────────
def get_records():
    """Retorna todos los registros, ordenados por createdAt DESC."""
    try:
        session = get_session()
        records = session.query(PdfRecord).order_by(PdfRecord.createdAt.desc()).all()
        result = [r.to_dict() for r in records]
        session.close()
        return jsonify(result)
    except Exception as e:
        print(f'[get_records] ERROR:', e)
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/upload
# ──────────────────────────────────────────────────────────────────────────────
def upload_pdfs():
    """
    1. Sube PDFs
    2. Detecta duplicados por LU antes de guardar
    3. Procesa los nuevos con pdfplumber (3 capas)
    4. Guarda en PostgreSQL
    5. Retorna { count, duplicates }
    """
    from app.config import Config

    if 'pdfs' not in request.files:
        return jsonify({'error': 'No se enviaron archivos'}), 400

    files = request.files.getlist('pdfs')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No se seleccionaron archivos'}), 400

    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    session = get_session()
    nuevos = []
    duplicados = []

    for file in files:
        if file.filename == '' or not _allowed_file(file.filename):
            continue

        safe_name = secure_filename(file.filename)
        unique = f"{os.getpid()}-{os.urandom(4).hex()}-{safe_name}"
        filepath = os.path.join(Config.UPLOAD_FOLDER, unique)
        file.save(filepath)

        # Extraer LU + procesar — una sola vez
        parsed = None
        lu = ''
        try:
            parsed = pdf_service.process_pdf(filepath)
            lu = parsed.header.lu or ''

            # ── Debug: texto antes y después de limpiar ──
            from app.services.text_cleaner import clean_text
            from app.services.pdf_extractor import extract_all_pages
            pages_raw = extract_all_pages(filepath)
            raw_text = '\n\n'.join(p.raw_text for p in pages_raw)
            cleaned_text = clean_text(raw_text)
            print(f'===== [{file.filename}] RAW ({len(raw_text)} chars) =====')
            print(raw_text[:1500])
            print(f'===== [{file.filename}] CLEANED ({len(cleaned_text)} chars) =====')
            print(cleaned_text[:1500])
            print(f'===== FIN =====')
        except Exception as e:
            print(f'[upload] OCR error on {file.filename}:', e)

        # Chequear duplicado
        if lu:
            existing = session.query(PdfRecord).filter(PdfRecord.lu == lu).first()
            if existing:
                duplicados.append({'nombre': file.filename, 'lu': lu})
                os.remove(filepath)
                continue

        # Ya tenemos parsed del primer llamado — no llamar de nuevo

        record = PdfRecord(
            id=str(uuid.uuid4()),
            filename=unique,
            originalName=file.filename,
            lu=parsed.header.lu if parsed else '',
            nombre=parsed.header.nombre if parsed else '',
            documento=parsed.header.documento if parsed else '',
            inscripcion=parsed.header.inscripcion if parsed else '',
            carrera=parsed.header.carrera if parsed else '',
            orientacion=parsed.header.orientacion if parsed else '',
            plan=parsed.header.plan if parsed else '',
            materiasJson=json.dumps([
                {'materia': m.materia, 'codigo': m.codigo,
                 'fecha_pedido': m.fecha_pedido, 'plan': m.plan}
                for m in (parsed.materias_optativas if parsed else [])
            ]),
            anualesJson=json.dumps([
                {
                    'anio': a.anio,
                    'periodo_lectivo': a.periodo_lectivo,
                    'generica': [
                        {'codigo': g.codigo, 'tipo': g.tipo,
                         'materia_nombre': g.materia_nombre, 'materia_codigo': g.materia_codigo}
                        for g in a.generica
                    ],
                }
                for a in (parsed.anuales if parsed else [])
            ]),
            procesado=False,
        )
        session.add(record)
        nuevos.append(file.filename)
        print(f'[upload] saved {file.filename} LU={record.lu}')

    session.commit()
    session.close()

    return jsonify({
        'message': f'{len(nuevos)} archivo(s) subido(s)',
        'count': len(nuevos),
        'duplicates': duplicados,
    }), 200


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/records/reprocess-all
# ──────────────────────────────────────────────────────────────────────────────
def reprocess_all():
    """Reprocesa todos los registros existentes."""
    session = get_session()
    records = session.query(PdfRecord).all()
    count = 0

    for record in records:
        path = _get_upload_path(record.filename)
        if not os.path.exists(path):
            continue
        try:
            parsed = pdf_service.process_pdf(path)

            # ── Debug: texto antes y después de limpiar ──
            from app.services.text_cleaner import clean_text
            from app.services.pdf_extractor import extract_all_pages
            pages_raw = extract_all_pages(path)
            raw_text = '\n\n'.join(p.raw_text for p in pages_raw)
            cleaned_text = clean_text(raw_text)
            print(f'===== [{record.originalName}] RAW ({len(raw_text)} chars) =====')
            print(raw_text[:1500])
            print(f'===== [{record.originalName}] CLEANED ({len(cleaned_text)} chars) =====')
            print(cleaned_text[:1500])
            print(f'===== FIN =====')

            record.lu = parsed.header.lu or ''
            record.nombre = parsed.header.nombre or ''
            record.documento = parsed.header.documento or ''
            record.inscripcion = parsed.header.inscripcion or ''
            record.carrera = parsed.header.carrera or ''
            record.orientacion = parsed.header.orientacion or ''
            record.plan = parsed.header.plan or ''
            record.materiasJson = json.dumps([
                {'materia': m.materia, 'codigo': m.codigo,
                 'fecha_pedido': m.fecha_pedido, 'plan': m.plan}
                for m in parsed.materias_optativas
            ])
            record.anualesJson = json.dumps([
                {
                    'anio': a.anio, 'periodo_lectivo': a.periodo_lectivo,
                    'generica': [
                        {'codigo': g.codigo, 'tipo': g.tipo,
                         'materia_nombre': g.materia_nombre, 'materia_codigo': g.materia_codigo}
                        for g in a.generica
                    ],
                }
                for a in parsed.anuales
            ])
            session.add(record)
            count += 1
            print(f'[reprocess-all] {record.originalName} → LU={record.lu}')
        except Exception as e:
            print(f'[reprocess-all] error on {record.filename}:', e)

    session.commit()
    session.close()
    return jsonify({'message': f'Reprocesados {count} registros', 'count': count}), 200


# ──────────────────────────────────────────────────────────────────────────────
# PUT /api/records/<id>
# ──────────────────────────────────────────────────────────────────────────────
def update_record(id: str):
    """Actualiza campos de un registro."""
    session = get_session()
    record = session.query(PdfRecord).filter(PdfRecord.id == id).first()
    if not record:
        session.close()
        return jsonify({'error': 'Record not found'}), 404

    body = request.get_json() or {}
    editable_fields = ['lu', 'nombre', 'documento', 'inscripcion', 'carrera',
                      'orientacion', 'plan', 'materias_json', 'anuales_json', 'procesado']

    for field in editable_fields:
        if field in body:
            setattr(record, field, body[field])

    session.add(record)
    session.commit()
    result = record.to_dict()
    session.close()
    return jsonify(result)


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/records/<id>/reprocess
# ──────────────────────────────────────────────────────────────────────────────
def reprocess_record(id: str):
    """Reprocesa un solo registro."""
    session = get_session()
    record = session.query(PdfRecord).filter(PdfRecord.id == id).first()
    if not record:
        session.close()
        return jsonify({'error': 'Record not found'}), 404

    path = _get_upload_path(record.filename)
    if not os.path.exists(path):
        session.close()
        return jsonify({'error': 'PDF no encontrado'}), 404

    try:
        parsed = pdf_service.process_pdf(path)

        # ── Debug: texto antes y después de limpiar ──
        from app.services.text_cleaner import clean_text
        from app.services.pdf_extractor import extract_all_pages
        pages_raw = extract_all_pages(path)
        raw_text = '\n\n'.join(p.raw_text for p in pages_raw)
        cleaned_text = clean_text(raw_text)
        print(f'===== [{record.originalName}] RAW ({len(raw_text)} chars) =====')
        print(raw_text[:1500])
        print(f'===== [{record.originalName}] CLEANED ({len(cleaned_text)} chars) =====')
        print(cleaned_text[:1500])
        print(f'===== FIN =====')

        record.lu = parsed.header.lu or ''
        record.nombre = parsed.header.nombre or ''
        record.documento = parsed.header.documento or ''
        record.inscripcion = parsed.header.inscripcion or ''
        record.carrera = parsed.header.carrera or ''
        record.orientacion = parsed.header.orientacion or ''
        record.plan = parsed.header.plan or ''
        record.materiasJson = json.dumps([
            {'materia': m.materia, 'codigo': m.codigo,
             'fecha_pedido': m.fecha_pedido, 'plan': m.plan}
            for m in parsed.materias_optativas
        ])
        record.anualesJson = json.dumps([
            {
                'anio': a.anio, 'periodo_lectivo': a.periodo_lectivo,
                'generica': [
                    {'codigo': g.codigo, 'tipo': g.tipo,
                     'materia_nombre': g.materia_nombre, 'materia_codigo': g.materia_codigo}
                    for g in a.generica
                ],
            }
            for a in parsed.anuales
        ])
        session.add(record)
        session.commit()
        result = record.to_dict()
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        print(f'[reprocess_record] ERROR:', e)
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# DELETE /api/records/<id>
# ──────────────────────────────────────────────────────────────────────────────
def delete_record(id: str):
    """Elimina un registro y su archivo."""
    session = get_session()
    record = session.query(PdfRecord).filter(PdfRecord.id == id).first()
    if record:
        path = _get_upload_path(record.filename)
        if os.path.exists(path):
            os.remove(path)
        session.delete(record)
        session.commit()
    session.close()
    return jsonify({'message': 'Record deleted'})


# ──────────────────────────────────────────────────────────────────────────────
# DELETE /api/records
# ──────────────────────────────────────────────────────────────────────────────
def delete_all():
    """Elimina todos los registros y archivos."""
    session = get_session()
    records = session.query(PdfRecord).all()
    for record in records:
        path = _get_upload_path(record.filename)
        if os.path.exists(path):
            os.remove(path)
        session.delete(record)
    session.commit()
    session.close()
    return jsonify({'message': f'Eliminados {len(records)} registros'})


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/export?anio=X
# ──────────────────────────────────────────────────────────────────────────────
def export_excel():
    """Exporta todos los registros a Excel."""
    filtro_anio = request.args.get('anio', type=int, default=0)

    session = get_session()
    records = session.query(PdfRecord).all()
    session.close()

    from ..services.excel_export import export_to_excel
    try:
        buf = export_to_excel(records, filtro_anio)
        from flask import make_response
        response = make_response(buf)
        response.headers['Content-Disposition'] = 'attachment; filename=inscripciones.xlsx'
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        return response
    except Exception as e:
        print(f'[export] ERROR:', e)
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/test/compare?filename=X
# ──────────────────────────────────────────────────────────────────────────────
def test_compare():
    """Comparativa de las 4 librerías Python."""
    filename = request.args.get('filename', '')
    if not filename:
        return jsonify({'error': 'filename es requerido'}), 400

    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'PDF no encontrado'}), 404

    try:
        results = pdf_service.compare_libraries(path)
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/test/debug/<filename>
# ──────────────────────────────────────────────────────────────────────────────
def test_debug(filename: str):
    """Debug verbose de las 3 capas."""
    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'PDF no encontrado'}), 404
    try:
        return jsonify(pdf_service.extract_for_debug(path))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/uploads/<filename>
# ──────────────────────────────────────────────────────────────────────────────
def serve_upload(filename: str):
    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'Archivo no encontrado'}), 404
    return send_file(path, mimetype='application/pdf')


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/list
# ──────────────────────────────────────────────────────────────────────────────
def list_uploads():
    from app.config import Config
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    files = [
        {'filename': f, 'size': os.path.getsize(os.path.join(Config.UPLOAD_FOLDER, f))}
        for f in os.listdir(Config.UPLOAD_FOLDER)
        if os.path.isfile(os.path.join(Config.UPLOAD_FOLDER, f))
    ]
    return jsonify({'files': files})


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/metadata?filename=X
# ──────────────────────────────────────────────────────────────────────────────
def get_metadata():
    """Extrae metadata del PDF: navegador, creador, fechas, etc."""
    filename = request.args.get('filename', '')
    if not filename:
        return jsonify({'error': 'filename es requerido'}), 400

    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'PDF no encontrado'}), 404

    try:
        from ..services.pdf_metadata import get_pdf_metadata
        meta = get_pdf_metadata(path)
        print(f'[metadata] {filename}: browser={meta["browser"]} producer={meta["producer"]}')
        return jsonify(meta)
    except Exception as e:
        print(f'[metadata] ERROR:', e)
        return jsonify({'error': str(e)}), 500
# POST /api/migrate
# ──────────────────────────────────────────────────────────────────────────────
def migrate_records():
    """Re-procesa todos los PDFs existentes para poblar los campos genéricos."""
    try:
        result = migrate_all()
        return jsonify(result)
    except Exception as e:
        print(f'[migrate] ERROR:', e)
        return jsonify({'error': str(e)}), 500