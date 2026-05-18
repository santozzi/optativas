import React, { useState, useEffect, useCallback, useRef } from 'react';

interface MateriaOptativa {
  materia: string;
  codigo: string;
  fechaPedido: string;
  plan: string;
}

interface GenericaItem {
  código: string;
  tipo: string;
  carrera: string;
  plan: number;
  materia?: { nombre: string; código: string };
}

interface Anual {
  año: number;
  periodoLectivo: string;
  generica: GenericaItem[];
}

interface PdfRecord {
  id: string;
  filename: string;
  originalName: string;
  lu: string;
  nombre: string;
  documento: string;
  inscripcion: string;
  carrera: string;
  orientacion: string;
  plan: string;
  materias: MateriaOptativa[];
  anuales: Anual[];
  procesado: boolean;
  createdAt: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface FileProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
}

const API_URL = '/api';
const AÑO_DEFAULT = 6;

/* ──────────────── Iconos SVG ──────────────── */
const IconUpload = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const IconExcel = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ──────────────── Circular Progress ──────────────── */
function CircularProgress({ percentage, size = 40, strokeWidth = 4, color = '#2563eb' }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) {
  const r = (size - strokeWidth) / 2;
  const c = r * 2 * Math.PI;
  const offset = c - (percentage / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.3s ease' }}/>
      </svg>
      <span style={{ position: 'absolute', fontSize: 10, fontWeight: 700, color: '#374151' }}>{Math.round(percentage)}%</span>
    </div>
  );
}

/* ──────────────── Linear Progress ──────────────── */
function LinearProgress({ percentage, color = '#2563eb' }: { percentage: number; color?: string }) {
  return (
    <div style={{ width: '100%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: 3, transition: 'width 0.3s ease' }}/>
    </div>
  );
}

/* ──────────────── Stat Card ──────────────── */
function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f3f4f6', flex: 1, minWidth: 160 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

/* ──────────────── Toast ──────────────── */
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#fff', borderRadius: 10, padding: '14px 18px', minWidth: 260,
          boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          borderLeft: `4px solid ${t.type === 'success' ? '#10b981' : t.type === 'error' ? '#ef4444' : '#3b82f6'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, animation: 'toastIn 0.3s ease',
        }}>
          <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}><IconClose /></button>
        </div>
      ))}
    </div>
  );
}

/* ──────────────── Toggle Switch ──────────────── */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, backgroundColor: checked ? '#10b981' : '#d1d5db', border: 'none', cursor: 'pointer', padding: 0, transition: 'background-color 0.2s' }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.2s ease' }}/>
    </button>
  );
}

/* ──────────────── Status Badge ──────────────── */
function StatusBadge({ status }: { status: FileProgress['status'] }) {
  const config: Record<FileProgress['status'], { label: string; bg: string; color: string; dot: string }> = {
    pending:   { label: 'Pendiente',   bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
    uploading: { label: 'Subiendo...', bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
    processing:{ label: 'OCR...',      bg: '#fef3c7', color: '#b45309', dot: '#f59e0b' },
    done:      { label: 'Listo',       bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
    error:     { label: 'Error',       bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  };
  const c = config[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: c.bg, color: c.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.dot, display: 'inline-block', animation: status === 'uploading' || status === 'processing' ? 'pulse 1.5s infinite' : undefined }}/>
      {c.label}
    </span>
  );
}

/* ──────────────── App Principal ──────────────── */
function App() {
  const [records, setRecords] = useState<PdfRecord[]>([]);
  const [files, setFiles] = useState<FileProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PdfRecord>>({});
  const [dragOver, setDragOver] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroAnio, setFiltroAnio] = useState<number>(AÑO_DEFAULT);
  const toastIdRef = useRef(0);

  useEffect(() => { fetchRecords(); }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => { setToasts(prev => prev.filter(t => t.id !== id)); }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/records`);
      const data = await res.json();
      console.log('[fetchRecords] Datos recibidos del backend:', data);
      setRecords(data);
    } catch (err) {
      console.error('Error fetching records:', err);
      showToast('Error cargando registros', 'error');
    }
  }, [showToast]);

  const addFiles = useCallback((newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) { showToast('Solo se permiten archivos PDF', 'error'); return; }
    setFiles(prev => [...prev, ...pdfFiles.map(f => ({ file: f, progress: 0, status: 'pending' as const }))]);
    showToast(`${pdfFiles.length} archivo(s) agregado(s)`, 'info');
  }, [showToast]);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(Array.from(e.target.files)); };

  const simulateUploadProgress = useCallback(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 95) { progress = 95; clearInterval(interval); }
      setUploadProgress(Math.min(progress, 95));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true); setUploadProgress(0);
    setFiles(prev => prev.map(fp => ({ ...fp, status: 'uploading', progress: 0 })));
    const clearSim = simulateUploadProgress();
    const formData = new FormData();
    files.forEach(fp => formData.append('pdfs', fp.file));
    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const result = await res.json();
      clearSim(); setUploadProgress(100);
      showToast(`${result.count} archivo(s) subido(s) correctamente`, 'success');
      setFiles(prev => prev.map(fp => ({ ...fp, status: 'processing', progress: 100 })));
      setTimeout(() => { fetchRecords().then(() => { showToast('OCR completado y registros actualizados', 'success'); setFiles([]); }); }, 2000);
    } catch (err) {
      clearSim(); setUploadProgress(0);
      showToast('Error al subir archivos', 'error');
      setFiles(prev => prev.map(fp => ({ ...fp, status: 'error', progress: 0 })));
    } finally { setUploading(false); setTimeout(() => setUploadProgress(0), 1500); }
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const startEdit = (record: PdfRecord) => {
    setEditingId(record.id);
    setEditForm({ lu: record.lu, nombre: record.nombre, documento: record.documento, inscripcion: record.inscripcion, carrera: record.carrera, orientacion: record.orientacion, plan: record.plan });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`${API_URL}/records/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
      if (res.ok) { setEditingId(null); fetchRecords(); showToast('Cambios guardados', 'success'); }
    } catch (err) { showToast('Error guardando cambios', 'error'); }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try { await fetch(`${API_URL}/records/${id}`, { method: 'DELETE' }); fetchRecords(); showToast('Registro eliminado', 'success'); }
    catch (err) { showToast('Error eliminando registro', 'error'); }
  };

  const reprocessAll = async () => {
    if (!confirm('¿Reprocesar TODOS los registros?')) return;
    showToast('Reprocesando todos los registros...', 'info');
    try {
      const res = await fetch(`${API_URL}/records/reprocess-all`, { method: 'POST' });
      const result = await res.json();
      showToast(result.message, 'success');
      fetchRecords();
    } catch (err) { showToast('Error al reprocesar registros', 'error'); }
  };

  const deleteAll = async () => {
    if (!confirm('¿Eliminar TODOS los registros?')) return;
    try { await fetch(`${API_URL}/records`, { method: 'DELETE' }); fetchRecords(); showToast('Todos los registros eliminados', 'success'); }
    catch (err) { showToast('Error al eliminar todos', 'error'); }
  };

  const toggleProcesado = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`${API_URL}/records/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ procesado: !current }) });
      if (res.ok) { fetchRecords(); showToast(current ? 'Marcado como pendiente' : 'Marcado como revisado', 'success'); }
    } catch (err) { showToast('Error actualizando estado', 'error'); }
  };

  const exportExcel = async () => {
    try {
      // Enviar filtro de año al backend
      const res = await fetch(`${API_URL}/export?anio=${filtroAnio}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inscripciones-año${filtroAnio === 0 ? 'todos' : filtroAnio}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Excel descargado', 'success');
    } catch (err) { showToast('Error exportando Excel', 'error'); }
  };

  // ── Filtrado por año ──
  const filteredRecords = records.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (r.nombre || '').toLowerCase().includes(q) || (r.lu || '').includes(q) || (r.carrera || '').toLowerCase().includes(q) || (r.documento || '').includes(q) || (r.inscripcion || '').includes(q);
    if (!matchSearch) return false;
    if (filtroAnio === 0) return true; // "todos"
    return (r.anuales || []).some(a => a.año === filtroAnio);
  });

  const processedCount = records.filter(r => r.procesado).length;

  // Años disponibles en los registros
  const añosDisponibles = [...new Set((records.flatMap(r => (r.anuales || []).map(a => a.año)) as number[]).filter(Boolean))].sort();

  // Para la vista expandida por año
  type ExpandYear = 0 | 3 | 6;
  const [expandedYears, setExpandedYears] = useState<Record<string, ExpandYear[]>>({});

  const toggleYear = (recordId: string, año: number) => {
    setExpandedYears(prev => {
      const current = prev[recordId] || [];
      const filtered = current.filter(y => y !== año);
      if (filtered.length === current.length) {
        // no estaba — agregarlo
        return { ...prev, [recordId]: [...current, año as ExpandYear] };
      } else {
        // estaba — sacarlo
        return { ...prev, [recordId]: filtered as ExpandYear[] };
      }
    });
  };

  const isYearExpanded = (recordId: string, año: number) => (expandedYears[recordId] || []).includes(año as ExpandYear);

  return (
    <>
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        body { margin: 0; background-color: #f5f7fa; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .anio-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-block; }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>Gestión de Inscripciones PDF</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 15 }}>Subí, procesá y gestioná las inscripciones de forma centralizada</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard label="Total Registros" value={records.length} color="#2563eb" icon={<IconFile />} />
          <StatCard label="Revisados" value={processedCount} color="#10b981" icon={<IconCheck />} />
          <StatCard label="Pendientes" value={records.length - processedCount} color="#f59e0b" icon={<IconRefresh />} />
          {records.length > 0 && (
            <div style={{ flex: 1, minWidth: 160, background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 10 }}>Progreso de Revisión</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <CircularProgress percentage={records.length ? Math.round((processedCount / records.length) * 100) : 0} size={50} strokeWidth={5} color="#10b981" />
                <div style={{ flex: 1 }}>
                  <LinearProgress percentage={records.length ? (processedCount / records.length) * 100 : 0} color="#10b981" />
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{processedCount} de {records.length} registros revisados</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', textAlign: 'center', border: dragOver ? '2px dashed #2563eb' : '2px dashed #e5e7eb', backgroundColor: dragOver ? '#eff6ff' : '#fff', transition: 'all 0.2s ease', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
          <div style={{ color: dragOver ? '#2563eb' : '#9ca3af', marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconUpload /></div>
          <p style={{ margin: '0 0 8px 0', fontSize: 17, fontWeight: 600, color: '#374151' }}>{dragOver ? 'Soltá los archivos aquí' : 'Arrastrá tus PDFs aquí'}</p>
          <p style={{ margin: '0 0 20px 0', fontSize: 14, color: '#9ca3af' }}>o hacé clic para seleccionar archivos</p>
          <label style={{ display: 'inline-block', padding: '10px 24px', backgroundColor: '#2563eb', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563eb'}>
            Seleccionar PDFs<input type="file" accept=".pdf" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Pending Files */}
        {files.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Archivos pendientes ({files.length})</h3>
              {uploading && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 13, color: '#6b7280' }}>Subiendo...</span><CircularProgress percentage={uploadProgress} size={32} strokeWidth={4} /></div>}
            </div>
            {uploading && <div style={{ marginBottom: 20 }}><LinearProgress percentage={uploadProgress} color="#2563eb" /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span style={{ fontSize: 12, color: '#9ca3af' }}>Progreso total</span><span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{Math.round(uploadProgress)}%</span></div></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {files.map((fp, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#9ca3af' }}><IconFile /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fp.file.name}</span>
                      <StatusBadge status={fp.status} />
                    </div>
                    <LinearProgress percentage={fp.progress} color={fp.status === 'error' ? '#ef4444' : '#2563eb'} />
                  </div>
                  {!uploading && <button onClick={() => removeFile(i)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}><IconTrash /></button>}
                </div>
              ))}
            </div>
            <button onClick={uploadFiles} disabled={uploading} style={{ marginTop: 20, width: '100%', padding: '12px 24px', backgroundColor: uploading ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? 'Subiendo y procesando OCR...' : `Subir ${files.length} archivo(s)`}
            </button>
          </div>
        )}

        {/* Records + Filtro + Export */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
              Archivos subidos ({filteredRecords.length} de {records.length})
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', width: 200 }}
                onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}/>

              {/* Select filtro año */}
              <select value={filtroAnio} onChange={e => setFiltroAnio(Number(e.target.value))} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                <option value={0}>Todos los años</option>
                {añosDisponibles.map(a => <option key={a} value={a}>Año {a}</option>)}
              </select>

              <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d1fae5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ecfdf5'}>
                <IconExcel /> Exportar Excel{filtroAnio !== 0 ? ` (Año ${filtroAnio})` : ''}
              </button>
              {records.length > 0 && (
                <>
                  <button onClick={reprocessAll} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef08a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fef9c3'}><IconRefresh /> Reprocesar</button>
                  <button onClick={deleteAll} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fee2e2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fef2f2'}><IconTrash /> Borrar Todos</button>
                </>
              )}
            </div>
          </div>

          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', color: '#d1d5db' }}><IconFile /></div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>No hay archivos subidos todavía</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <p style={{ margin: 0, fontSize: 14 }}>No hay registros para el año seleccionado</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['#', 'Nombre Completo', 'LU', 'Documento', 'Inscripción', 'Carrera / Orientación', 'Plan', 'Materias Optativas', 'Estado', 'Acciones'].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '2px solid #f3f4f6', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, idx) => (
                    <React.Fragment key={record.id}>
                      <tr style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#fafafa'}>
                        <td style={{ padding: '14px 8px', width: 40, textAlign: 'center' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: record.procesado ? '#d1fae5' : '#fee2e2', color: record.procesado ? '#10b981' : '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}><IconFile /></div>
                        </td>
                        {editingId === record.id ? (
                          <><td colSpan={7} style={{ padding: 10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                              {(['lu','nombre','documento','inscripcion','carrera','orientacion','plan'] as const).map(f => (
                                <div key={f}>
                                  <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.toUpperCase()}</label>
                                  <input value={(editForm as any)[f] || ''} onChange={e => setEditForm({ ...editForm, [f]: e.target.value })} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                                    onFocus={e => e.currentTarget.style.borderColor = '#2563eb'} onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}/>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                              <button onClick={saveEdit} style={{ padding: '7px 14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><IconCheck /> Guardar</button>
                              <button onClick={() => setEditingId(null)} style={{ padding: '7px 14px', backgroundColor: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                            </div>
                          </td></>
                        ) : (
                          <>
                            <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', fontWeight: 500 }}>{record.nombre || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                            <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'monospace' }}>{record.lu || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                            <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'monospace' }}>{record.documento || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                            <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'monospace' }}>{record.inscripcion || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                            <td style={{ padding: '14px 16px', fontSize: 12, color: '#374151' }}>
                              <div>{record.carrera || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                              {record.orientacion && <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{record.orientacion}</div>}
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: 13 }}>{record.plan || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                            <td style={{ padding: '14px 12px', maxWidth: 220 }}>
                              {/* Badges de años disponibles */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                {(record.anuales || []).map((a, ai) => (
                                  <button key={ai} onClick={() => toggleYear(record.id, a.año)}
                                    style={{
                                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                      border: '1px solid',
                                      borderColor: isYearExpanded(record.id, a.año) ? '#2563eb' : '#e5e7eb',
                                      backgroundColor: isYearExpanded(record.id, a.año) ? '#eff6ff' : '#f9fafb',
                                      color: isYearExpanded(record.id, a.año) ? '#1d4ed8' : '#6b7280',
                                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                    Año {a.año}
                                    {isYearExpanded(record.id, a.año) && a.generica.length > 0 && (
                                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{a.generica.length}m</span>
                                    )}
                                  </button>
                                ))}
                                {(!record.anuales || record.anuales.length === 0) && <span style={{ color: '#d1d5db', fontSize: 12 }}>Sin materias</span>}
                              </div>
                              {/* Detalle expandido */}
                              {isYearExpanded(record.id, 0) && record.anuales?.map((a, ai) => (
                                <div key={ai} style={{ marginTop: 8, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Año {a.año} — {a.periodoLectivo}</div>
                                  {a.generica.map((g, gi) => (
                                    <div key={gi} style={{ marginBottom: 5, fontSize: 11 }}>
                                      <span style={{ fontWeight: 700, color: '#374151' }}>{g.código}</span>
                                      <span style={{ color: '#9ca3af', marginLeft: 6 }}>{g.tipo}</span>
                                      {g.materia && <div style={{ color: '#2563eb', marginTop: 2, fontWeight: 600 }}>{g.materia.nombre} ({g.materia.código})</div>}
                                    </div>
                                  ))}
                                  {a.generica.length === 0 && <div style={{ color: '#d1d5db', fontSize: 11 }}>Sin genericas</div>}
                                </div>
                              ))}
                              {(() => {
                                const expanded = expandedYears[record.id] || [];
                                return expanded.filter(y => y !== 0).map(año => {
                                  const a = record.anuales?.find(an => an.año === año);
                                  if (!a) return null;
                                  return (
                                    <div key={año} style={{ marginTop: 8, padding: '8px 10px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>Año {a.año} — {a.periodoLectivo}</div>
                                      {a.generica.map((g, gi) => (
                                        <div key={gi} style={{ marginBottom: 5, fontSize: 11 }}>
                                          <span style={{ fontWeight: 700, color: '#374151' }}>{g.código}</span>
                                          <span style={{ color: '#9ca3af', marginLeft: 6 }}>{g.tipo}</span>
                                          {g.materia && <div style={{ color: '#2563eb', marginTop: 2, fontWeight: 600 }}>{g.materia.nombre} ({g.materia.código})</div>}
                                        </div>
                                      ))}
                                      {a.generica.length === 0 && <div style={{ color: '#9ca3af', fontSize: 11 }}>Sin genericas</div>}
                                    </div>
                                  );
                                });
                              })()}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <ToggleSwitch checked={record.procesado} onChange={() => toggleProcesado(record.id, record.procesado)} />
                            </td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              <button onClick={() => startEdit(record)} style={{ padding: '7px 10px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginRight: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconEdit /> Editar</button>
                              <button onClick={() => deleteRecord(record.id)} style={{ padding: '7px 10px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconTrash /> Eliminar</button>
                            </td>
                          </>
                        )}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;