"""
Rutas — mapea URLs a controladores.
"""

from flask import Blueprint
from ..controllers import records_controller

api = Blueprint('api', __name__, url_prefix='/api')

# ── Records (CRUD) ──
api.add_url_rule('/records', view_func=records_controller.get_records, methods=['GET'])
api.add_url_rule('/records', view_func=records_controller.delete_all, methods=['DELETE'])
api.add_url_rule('/records/<id>', view_func=records_controller.update_record, methods=['PUT'])
api.add_url_rule('/records/<id>', view_func=records_controller.delete_record, methods=['DELETE'])
api.add_url_rule('/records/<id>/reprocess', view_func=records_controller.reprocess_record, methods=['POST'])
api.add_url_rule('/records/reprocess-all', view_func=records_controller.reprocess_all, methods=['POST'])

# ── Upload (archivos) ──
api.add_url_rule('/upload', view_func=records_controller.upload_pdfs, methods=['POST'])

# ── Export ──
api.add_url_rule('/export', view_func=records_controller.export_excel, methods=['GET'])

# ── Test / debug ──
api.add_url_rule('/test/compare', view_func=records_controller.test_compare, methods=['GET'])
api.add_url_rule('/test/debug/<filename>', view_func=records_controller.test_debug, methods=['GET'])

# ── Static files ──
api.add_url_rule('/uploads/<filename>', view_func=records_controller.serve_upload, methods=['GET'])
api.add_url_rule('/list', view_func=records_controller.list_uploads, methods=['GET'])
api.add_url_rule('/migrate', view_func=records_controller.migrate_records, methods=['POST'])
api.add_url_rule('/metadata', view_func=records_controller.get_metadata, methods=['GET'])