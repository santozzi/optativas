"""
Controladores PDF — toda la lógica de negocio.
Se llaman desde las rutas y delegan en los servicios.
"""

import os
from flask import request, jsonify, send_file
from werkzeug.utils import secure_filename
from ..services import pdf_service


ALLOWED_EXTENSIONS = {'pdf'}


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _get_upload_path(filename: str) -> str:
    from app.config import Config
    return os.path.join(Config.UPLOAD_FOLDER, filename)


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/upload
# ──────────────────────────────────────────────────────────────────────────────
def upload_pdfs():
    """Sube PDFs al servidor."""
    from app.config import Config

    if 'pdfs' not in request.files:
        return jsonify({'error': 'No se enviaron archivos'}), 400

    files = request.files.getlist('pdfs')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No se seleccionaron archivos'}), 400

    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    saved = []

    for file in files:
        if file.filename == '':
            continue
        if not _allowed_file(file.filename):
            return jsonify({'error': f'Extensión no permitida: {file.filename}'}), 400

        safe_name = secure_filename(file.filename)
        unique = f"{os.getpid()}-{os.urandom(4).hex()}-{safe_name}"
        filepath = os.path.join(Config.UPLOAD_FOLDER, unique)
        file.save(filepath)
        saved.append({'original': file.filename, 'saved_as': unique})

    return jsonify({'message': f'{len(saved)} archivo(s) guardado(s)', 'files': saved}), 200


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/process/upload  — upload + process en un paso
# ──────────────────────────────────────────────────────────────────────────────
def upload_and_process():
    """Sube PDFs, los procesa con pdfplumber (3 capas) y retorna los datos."""
    from app.config import Config

    if 'pdfs' not in request.files:
        return jsonify({'error': 'No se enviaron archivos'}), 400

    files = request.files.getlist('pdfs')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No se seleccionaron archivos'}), 400

    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    results = []

    for file in files:
        if file.filename == '' or not _allowed_file(file.filename):
            continue

        safe_name = secure_filename(file.filename)
        unique = f"{os.getpid()}-{os.urandom(4).hex()}-{safe_name}"
        filepath = os.path.join(Config.UPLOAD_FOLDER, unique)
        file.save(filepath)

        try:
            parsed = pdf_service.process_pdf(filepath)
            results.append({
                'original': file.filename,
                'saved_as': unique,
                'ok': parsed.ok,
                'pages': parsed.raw_pages,
                'lu': parsed.header.lu,
                'nombre': parsed.header.nombre,
                'carrera': parsed.header.carrera,
                'plan': parsed.header.plan,
                'materias_optativas': [
                    {'materia': m.materia, 'codigo': m.codigo, 'fecha_pedido': m.fecha_pedido, 'plan': m.plan}
                    for m in parsed.materias_optativas
                ],
                'anuales': [
                    {
                        'anio': a.anio,
                        'periodo_lectivo': a.periodo_lectivo,
                        'generica': [
                            {'codigo': g.codigo, 'tipo': g.tipo,
                             'materia_nombre': g.materia_nombre, 'materia_codigo': g.materia_codigo}
                            for g in a.generica
                        ],
                    }
                    for a in parsed.anuales
                ],
                'errors': parsed.errors,
            })
            print(f'[upload+process] {file.filename} → LU={parsed.header.lu}')
        except Exception as e:
            print(f'[upload+process] ERROR on {file.filename}:', e)
            results.append({
                'original': file.filename,
                'saved_as': unique,
                'ok': False,
                'error': str(e),
            })

    return jsonify({'files': results}), 200


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/process  — process PDF ya subido
# ──────────────────────────────────────────────────────────────────────────────
def process_pdf():
    """Procesa un PDF existente con las 3 capas."""
    filename = request.args.get('filename', '')
    if not filename:
        return jsonify({'error': 'filename es requerido'}), 400

    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'PDF no encontrado'}), 404

    try:
        result = pdf_service.process_pdf(path)
        print(f'[process] LU={result.header.lu} materias={len(result.materias_optativas)} anuales={len(result.anuales)}')
        return jsonify({
            'ok': result.ok,
            'pages': result.raw_pages,
            'header': {
                'lu': result.header.lu,
                'inscripcion': result.header.inscripcion,
                'nombre': result.header.nombre,
                'documento': result.header.documento,
                'carrera': result.header.carrera,
                'plan': result.header.plan,
                'orientacion': result.header.orientacion,
            },
            'materias_optativas': [
                {'materia': m.materia, 'codigo': m.codigo, 'fecha_pedido': m.fecha_pedido, 'plan': m.plan}
                for m in result.materias_optativas
            ],
            'anuales': [
                {
                    'anio': a.anio,
                    'periodo_lectivo': a.periodo_lectivo,
                    'generica': [
                        {'codigo': g.codigo, 'tipo': g.tipo,
                         'materia_nombre': g.materia_nombre, 'materia_codigo': g.materia_codigo}
                        for g in a.generica
                    ],
                }
                for a in result.anuales
            ],
            'errors': result.errors,
        })
    except Exception as e:
        print(f'[process] ERROR:', e)
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/test/compare  — comparativa de las 4 librerías Python
# ──────────────────────────────────────────────────────────────────────────────
def test_compare():
    """Comparativa de todas las librerías Python."""
    filename = request.args.get('filename', '')
    if not filename:
        return jsonify({'error': 'filename es requerido'}), 400

    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'PDF no encontrado'}), 404

    try:
        results = pdf_service.compare_libraries(path)
        print(f'[compare:all] Summary:')
        for lib, r in results.items():
            status = f'OK ({r["chars"]} chars)' if r['success'] else f'FAIL - {r["error"]}'
            print(f'  {lib}: {status}')
        return jsonify(results)
    except Exception as e:
        print(f'[compare:all] ERROR:', e)
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/test/debug/<filename>  — debug verbose de las 3 capas
# ──────────────────────────────────────────────────────────────────────────────
def test_debug(filename: str):
    """Debug verbose: raw, cleaned y parsed de cada capa."""
    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'PDF no encontrado'}), 404

    try:
        result = pdf_service.extract_for_debug(path)
        print(f'[debug] pages={result["pages"]} raw_chars={result["extraction"]["raw_char_count"]} '
              f'cleaned_chars={result["cleaning"]["cleaned_char_count"]}')
        return jsonify(result)
    except Exception as e:
        print(f'[debug] ERROR:', e)
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/uploads/<filename>  — servir archivo PDF
# ──────────────────────────────────────────────────────────────────────────────
def serve_upload(filename: str):
    """Sirve un PDF para descarga."""
    path = _get_upload_path(filename)
    if not os.path.exists(path):
        return jsonify({'error': 'Archivo no encontrado'}), 404
    return send_file(path, mimetype='application/pdf')


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/list  — listar PDFs subidos
# ──────────────────────────────────────────────────────────────────────────────
def list_uploads():
    """Lista todos los PDFs subidos."""
    from app.config import Config
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    files = [
        {'filename': f, 'size': os.path.getsize(os.path.join(Config.UPLOAD_FOLDER, f))}
        for f in os.listdir(Config.UPLOAD_FOLDER)
        if os.path.isfile(os.path.join(Config.UPLOAD_FOLDER, f))
    ]
    return jsonify({'files': files})