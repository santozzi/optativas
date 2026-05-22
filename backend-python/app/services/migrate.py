"""
Migra los registros existentes de la DB a la nueva estructura de campos.
Safe: re-procesa cada PDF con las 3 capas y actualiza el registro.
"""

import os
import json
from app.config import Config
from app.services import pdf_service


def migrate_record(record) -> bool:
    """Migra un solo registro. Retorna True si se pudo."""
    pdf_path = os.path.join(Config.UPLOAD_FOLDER, record.filename)
    if not os.path.exists(pdf_path):
        print(f'[migrate_record] file not found: {pdf_path}')
        return False

    try:
        parsed = pdf_service.process_pdf(pdf_path)
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
                'anio': a.anio,
                'periodo_lectivo': a.periodo_lectivo,
                'generica': [
                    {
                        'codigo': g.codigo,
                        'tipo': g.tipo,
                        'materia': {
                            'codigo': g.materia_codigo or '',
                            'nombre': g.materia_nombre or '',
                        },
                    }
                    for g in a.generica
                ],
            }
            for a in parsed.anuales
        ])
        return True
    except Exception as e:
        print(f'[migrate_record] ERROR on {record.filename}:', e)
        return False


def migrate_all():
    """
    Re-procesa todos los registros existentes y actualiza sus JSON en la DB.
    """
    from app.models.pdf_record import get_session, PdfRecord
    session = get_session()
    records = session.query(PdfRecord).all()
    migrated = 0
    errors = 0

    for record in records:
        ok = migrate_record(record)
        if ok:
            session.add(record)
            migrated += 1
        else:
            errors += 1

    session.commit()
    session.close()
    print(f'[migrate_all] Done: {migrated} migrated, {errors} errors')
    return {'migrated': migrated, 'errors': errors}