"""
Backend Python/Flask — proyecto-pdf
"""

from flask import Flask
from flask_cors import CORS


def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')

    CORS(app)

    # Inicializar DB (crea tablas si no existen) — lazy, no bloquea startup
    try:
        from app.models.pdf_record import init_db
        init_db()
    except Exception as e:
        print('[init] DB not ready yet, will retry on first request:', e)

    from app.routes.pdf_routes import api
    app.register_blueprint(api)

    return app