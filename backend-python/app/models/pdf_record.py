"""
Modelos SQLAlchemy — mapeo de la tabla pdf_records EXISTENTE.
Coincide con los nombres de columna del backend Node.js original:
  originalName, materiasJson, anualesJson, createdAt
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

Base = declarative_base()


class PdfRecord(Base):
    __tablename__ = 'pdf_records'

    id = Column(String(36), primary_key=True)
    filename = Column(String(255), nullable=False)
    originalName = Column(String(255), nullable=False)      # camelCase original
    lu = Column(String(50), nullable=True)
    nombre = Column(String(255), nullable=True)
    documento = Column(String(50), nullable=True)
    inscripcion = Column(String(50), nullable=True)
    carrera = Column(String(100), nullable=True)
    orientacion = Column(String(100), nullable=True)
    plan = Column(String(20), nullable=True)
    materiasJson = Column(Text, nullable=True)                 # camelCase
    anualesJson = Column(Text, nullable=True)                # camelCase
    procesado = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.utcnow)   # camelCase

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'originalName': self.originalName,
            'lu': self.lu or '',
            'nombre': self.nombre or '',
            'documento': self.documento or '',
            'inscripcion': self.inscripcion or '',
            'carrera': self.carrera or '',
            'orientacion': self.orientacion or '',
            'plan': self.plan or '',
            # Frontend espera estos nombres de campo
            'materias': self._parse_json(self.materiasJson),
            'generica': [
                {
                    'año': a['anio'],
                    'periodoLectivo': a.get('periodoLectivo', ''),
                    'generica': [
                        {
                            'codigo': g.get('codigo', ''),
                            'tipo': g.get('tipo', ''),
                            'materia': {
                                'codigo': g.get('materiaCodigo', '') or (g.get('materia', {}) or {}).get('codigo', ''),
                                'nombre': g.get('materiaNombre', '') or (g.get('materia', {}) or {}).get('nombre', ''),
                            },
                        }
                        for g in a.get('generica', [])
                    ],
                }
                for a in self._parse_json(self.anualesJson)
            ],
            'procesado': self.procesado,
            'createdAt': self.createdAt.isoformat() if self.createdAt else None,
        }

    @staticmethod
    def _parse_json(value):
        if not value:
            return []
        import json
        try:
            return json.loads(value)
        except Exception:
            return []


_engine = None
_Session = None


def get_db_url():
    host = os.getenv('DB_HOST', 'localhost')
    port = os.getenv('DB_PORT', '5434')
    user = os.getenv('DB_USER', 'pdfuser')
    password = os.getenv('DB_PASS', 'pdfpass')
    dbname = os.getenv('DB_NAME', 'promedb')
    return f'postgresql://{user}:{password}@{host}:{port}/{dbname}'


def get_engine():
    global _engine
    if _engine is None:
        _engine = __import__('sqlalchemy').create_engine(
            get_db_url(), pool_pre_ping=True, pool_size=5, max_overflow=5
        )
    return _engine


def get_session():
    global _engine, _Session
    if _engine is None:
        get_engine()
    if _Session is None:
        _Session = sessionmaker(bind=_engine)
    return _Session()


def init_db():
    """Crea las tablas si no existen. Safe para llamar múltiples veces."""
    try:
        Base.metadata.create_all(get_engine())
    except Exception:
        pass