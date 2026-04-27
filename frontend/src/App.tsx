import React, { useState, useEffect, useCallback, useRef } from 'react';

interface PdfRecord {
  id: string;
  filename: string;
  originalName: string;
  apellidoNombre: string;
  lu: string;
  codigoCarrera: string;
  plan: string;
  codigoMateria: string;
  genericaAsociada: string;
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

/* ──────────────── Iconos SVG ──────────────── */
const IconUpload = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const IconExcel = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ──────────────── Componente: Circular Progress ──────────────── */
function CircularProgress({ percentage, size = 40, strokeWidth = 4, color = '#2563eb' }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none"/>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}/>
      </svg>
      <span style={{ position: 'absolute', fontSize: 10, fontWeight: 700, color: '#374151' }}>{Math.round(percentage)}%</span>
    </div>
  );
}

/* ──────────────── Componente: Linear Progress ──────────────── */
function LinearProgress({ percentage, color = '#2563eb' }: { percentage: number; color?: string }) {
  return (
    <div style={{ width: '100%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        width: `${percentage}%`,
        height: '100%',
        backgroundColor: color,
        borderRadius: 3,
        transition: 'width 0.3s ease',
      }}/>
    </div>
  );
}

/* ──────────────── Componente: Stat Card ──────────────── */
function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #f3f4f6',
      flex: 1,
      minWidth: 160,
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: `${color}15`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

/* ──────────────── Componente: Toast ──────────────── */
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#fff',
          borderRadius: 10,
          padding: '14px 18px',
          minWidth: 260,
          boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          borderLeft: `4px solid ${t.type === 'success' ? '#10b981' : t.type === 'error' ? '#ef4444' : '#3b82f6'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          animation: 'toastIn 0.3s ease',
        }}>
          <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
            <IconClose />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ──────────────── Componente: Status Badge ──────────────── */
/* ──────────────── Componente: Toggle Switch ──────────────── */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      position: 'relative',
      width: 44, height: 24, borderRadius: 12,
      backgroundColor: checked ? '#10b981' : '#d1d5db',
      border: 'none', cursor: 'pointer', padding: 0,
      transition: 'background-color 0.2s ease',
    }}>
      <span style={{
        position: 'absolute',
        top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%',
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        transition: 'left 0.2s ease',
      }}/>
    </button>
  );
}

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
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      backgroundColor: c.bg, color: c.color,
    }}>
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
  const toastIdRef = useRef(0);

  useEffect(() => {
    fetchRecords();
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/records`);
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error('Error fetching records:', err);
      showToast('Error cargando registros', 'error');
    }
  }, [showToast]);

  const addFiles = useCallback((newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      showToast('Solo se permiten archivos PDF', 'error');
      return;
    }
    setFiles(prev => [...prev, ...pdfFiles.map(f => ({ file: f, progress: 0, status: 'pending' as const }))]);
    showToast(`${pdfFiles.length} archivo(s) agregado(s)`, 'info');
  }, [showToast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const simulateUploadProgress = useCallback(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 95) {
        progress = 95;
        clearInterval(interval);
      }
      setUploadProgress(Math.min(progress, 95));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    // Marcar todos como subiendo
    setFiles(prev => prev.map(fp => ({ ...fp, status: 'uploading', progress: 0 })));

    const clearProgressSim = simulateUploadProgress();

    const formData = new FormData();
    files.forEach(fp => formData.append('pdfs', fp.file));

    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const result = await res.json();

      clearProgressSim();
      setUploadProgress(100);
      showToast(`${result.count} archivo(s) subido(s) correctamente`, 'success');

      // Marcar como procesando OCR
      setFiles(prev => prev.map(fp => ({ ...fp, status: 'processing', progress: 100 })));

      setTimeout(() => {
        fetchRecords().then(() => {
          showToast('OCR completado y registros actualizados', 'success');
          setFiles([]);
        });
      }, 2000);

    } catch (err) {
      clearProgressSim();
      setUploadProgress(0);
      console.error('Error uploading:', err);
      showToast('Error al subir archivos', 'error');
      setFiles(prev => prev.map(fp => ({ ...fp, status: 'error', progress: 0 })));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1500);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startEdit = (record: PdfRecord) => {
    setEditingId(record.id);
    setEditForm({
      apellidoNombre: record.apellidoNombre,
      lu: record.lu,
      codigoCarrera: record.codigoCarrera,
      plan: record.plan,
      codigoMateria: record.codigoMateria,
      genericaAsociada: record.genericaAsociada,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`${API_URL}/records/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchRecords();
        showToast('Cambios guardados', 'success');
      }
    } catch (err) {
      console.error('Error saving:', err);
      showToast('Error guardando cambios', 'error');
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await fetch(`${API_URL}/records/${id}`, { method: 'DELETE' });
      fetchRecords();
      showToast('Registro eliminado', 'success');
    } catch (err) {
      console.error('Error deleting:', err);
      showToast('Error eliminando registro', 'error');
    }
  };

  const deleteAll = async () => {
    if (!confirm('¿Eliminar TODOS los registros?')) return;
    try {
      for (const record of records) {
        await fetch(`${API_URL}/records/${record.id}`, { method: 'DELETE' });
      }
      fetchRecords();
      showToast('Todos los registros eliminados', 'success');
    } catch (err) {
      console.error('Error deleting all:', err);
      showToast('Error al eliminar todos', 'error');
    }
  };

  const toggleProcesado = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`${API_URL}/records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procesado: !current }),
      });
      if (res.ok) {
        fetchRecords();
        showToast(current ? 'Marcado como pendiente' : 'Marcado como revisado', 'success');
      }
    } catch (err) {
      showToast('Error actualizando estado', 'error');
    }
  };

  const exportExcel = async () => {
    try {
      const res = await fetch(`${API_URL}/export`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inscripciones.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Excel descargado', 'success');
    } catch (err) {
      console.error('Error exporting:', err);
      showToast('Error exportando Excel', 'error');
    }
  };

  const processedCount = records.filter(r => r.procesado).length;
  const pendingCount = records.length - processedCount;
  const hasData = records.length > 0;

  const filteredRecords = records.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      r.originalName.toLowerCase().includes(q) ||
      (r.apellidoNombre || '').toLowerCase().includes(q) ||
      (r.lu || '').toLowerCase().includes(q) ||
      (r.codigoCarrera || '').toLowerCase().includes(q) ||
      (r.plan || '').toLowerCase().includes(q) ||
      (r.codigoMateria || '').toLowerCase().includes(q) ||
      (r.genericaAsociada || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        body {
          margin: 0;
          background-color: #f5f7fa;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            Gestión de Inscripciones PDF
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 15 }}>Subí, procesá y gestioná las inscripciones de forma centralizada</p>
        </div>

        {/* Stats Dashboard */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard label="Total Registros" value={records.length} color="#2563eb" icon={<IconFile />} />
          <StatCard label="Revisados" value={processedCount} color="#10b981" icon={<IconCheck />} />
          <StatCard label="Pendientes de Revisión" value={pendingCount} color="#f59e0b" icon={<IconRefresh />} />
          {hasData && (
            <div style={{
              flex: 1, minWidth: 160, background: '#fff', borderRadius: 12, padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f3f4f6',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 10 }}>Progreso de Revisión</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <CircularProgress percentage={records.length ? Math.round((processedCount / records.length) * 100) : 0} size={50} strokeWidth={5} color="#10b981" />
                <div style={{ flex: 1 }}>
                  <LinearProgress percentage={records.length ? (processedCount / records.length) * 100 : 0} color="#10b981" />
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, fontWeight: 500 }}>
                    {processedCount} de {records.length} registros revisados
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '40px 32px',
          textAlign: 'center',
          border: dragOver ? '2px dashed #2563eb' : '2px dashed #e5e7eb',
          backgroundColor: dragOver ? '#eff6ff' : '#fff',
          transition: 'all 0.2s ease',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          cursor: 'pointer',
        }} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
          <div style={{ color: dragOver ? '#2563eb' : '#9ca3af', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <IconUpload />
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: 17, fontWeight: 600, color: '#374151' }}>
            {dragOver ? 'Soltá los archivos aquí' : 'Arrastrá tus PDFs aquí'}
          </p>
          <p style={{ margin: '0 0 20px 0', fontSize: 14, color: '#9ca3af' }}>o hacé clic para seleccionar archivos</p>
          <label style={{
            display: 'inline-block',
            padding: '10px 24px',
            backgroundColor: '#2563eb',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1d4ed8')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#2563eb')}>
            Seleccionar PDFs
            <input type="file" accept=".pdf" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Pending Files */}
        {files.length > 0 && (
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: '1px solid #f3f4f6',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                Archivos pendientes ({files.length})
              </h3>
              {uploading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Subiendo...</span>
                  <CircularProgress percentage={uploadProgress} size={32} strokeWidth={4} />
                </div>
              )}
            </div>

            {/* Overall upload progress bar */}
            {uploading && (
              <div style={{ marginBottom: 20 }}>
                <LinearProgress percentage={uploadProgress} color="#2563eb" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Progreso total</span>
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{Math.round(uploadProgress)}%</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {files.map((fp, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', background: '#f9fafb', borderRadius: 10,
                  border: '1px solid #f3f4f6',
                }}>
                  <div style={{ color: '#9ca3af' }}><IconFile /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fp.file.name}
                      </span>
                      <StatusBadge status={fp.status} />
                    </div>
                    <LinearProgress percentage={fp.progress} color={fp.status === 'error' ? '#ef4444' : '#2563eb'} />
                  </div>
                  {!uploading && (
                    <button onClick={() => removeFile(i)} style={{
                      background: '#fee2e2', color: '#ef4444', border: 'none',
                      borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} title="Quitar">
                      <IconTrash />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={uploadFiles}
              disabled={uploading}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '12px 24px',
                backgroundColor: uploading ? '#93c5fd' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 15,
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {uploading ? 'Subiendo y procesando OCR...' : `Subir ${files.length} archivo(s)`}
            </button>
          </div>
        )}

        {/* Records Table */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '24px 28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          border: '1px solid #f3f4f6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
              Archivos subidos ({records.length})
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                  outline: 'none',
                  width: 220,
                  transition: 'border 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              {searchQuery && (
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                  {filteredRecords.length} resultado{filteredRecords.length !== 1 ? 's' : ''}
                </span>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={exportExcel} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 18px', backgroundColor: '#ecfdf5', color: '#065f46',
                  border: '1px solid #a7f3d0', borderRadius: 8,
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  transition: 'all 0.2s',
                }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#d1fae5'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ecfdf5'; }}>
                  <IconExcel /> Exportar Excel
                </button>
                {records.length > 0 && (
                  <button onClick={deleteAll} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 18px', backgroundColor: '#fef2f2', color: '#991b1b',
                    border: '1px solid #fecaca', borderRadius: 8,
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}>
                    <IconTrash /> Borrar Todos
                  </button>
                )}
              </div>
            </div>
          </div>

          {records.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px', color: '#9ca3af',
            }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', color: '#d1d5db' }}>
                <IconFile />
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>No hay archivos subidos todavía</p>
              <p style={{ margin: '6px 0 0 0', fontSize: 13 }}>Subí tus primeros PDFs usando la zona de carga de arriba</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['', 'Apellido y Nombre', 'LU', 'Carrera', 'Plan', 'Materia', 'Genérica', 'Estado', 'Acciones'].map((h, i) => (
                      <th key={i} style={{
                        textAlign: 'left', padding: '12px 16px',
                        fontSize: 12, fontWeight: 700, color: '#6b7280',
                        textTransform: 'uppercase', letterSpacing: '0.4px',
                        borderBottom: '2px solid #f3f4f6', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, idx) => (
                    <tr key={record.id} style={{
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa',
                      transition: 'background 0.15s',
                    }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#fafafa'; }}>
                      <td style={{ padding: '14px 8px', width: 48, textAlign: 'center' }}>
                        <div title={record.originalName} style={{
                          width: 36, height: 36, borderRadius: 10,
                          backgroundColor: record.procesado ? '#d1fae5' : '#fee2e2',
                          color: record.procesado ? '#10b981' : '#ef4444',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'help',
                        }}>
                          <IconFile />
                        </div>
                      </td>
                      {editingId === record.id ? (
                        <>
                          {['apellidoNombre', 'lu', 'codigoCarrera', 'plan', 'codigoMateria', 'genericaAsociada'].map((field) => (
                            <td key={field} style={{ padding: '10px 12px' }}>
                              <input
                                value={(editForm as any)[field] || ''}
                                onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                                style={{
                                  width: '100%', minWidth: 80, padding: '8px 10px',
                                  border: '1px solid #d1d5db', borderRadius: 6,
                                  fontSize: 13, outline: 'none',
                                  transition: 'border 0.2s',
                                }}
                                onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
                                onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                              />
                            </td>
                          ))}
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <button onClick={saveEdit} style={{
                              padding: '7px 12px', backgroundColor: '#10b981', color: '#fff',
                              border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              cursor: 'pointer', marginRight: 6,
                            }}><IconCheck /> Guardar</button>
                            <button onClick={() => setEditingId(null)} style={{
                              padding: '7px 12px', backgroundColor: '#f3f4f6', color: '#6b7280',
                              border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              cursor: 'pointer',
                            }}><IconX /> Cancelar</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', fontWeight: 500 }}>{record.apellidoNombre || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', fontFamily: 'monospace' }}>{record.lu || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{record.codigoCarrera || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{record.plan || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{record.codigoMateria || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{record.genericaAsociada || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <ToggleSwitch checked={record.procesado} onChange={() => toggleProcesado(record.id, record.procesado)} />
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => startEdit(record)} style={{
                              padding: '7px 10px', backgroundColor: '#fffbeb', color: '#b45309',
                              border: '1px solid #fde68a', borderRadius: 6, fontSize: 12,
                              fontWeight: 600, cursor: 'pointer', marginRight: 6,
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}><IconEdit /> Editar</button>
                            <button onClick={() => deleteRecord(record.id)} style={{
                              padding: '7px 10px', backgroundColor: '#fef2f2', color: '#dc2626',
                              border: '1px solid #fecaca', borderRadius: 6, fontSize: 12,
                              fontWeight: 600, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}><IconTrash /> Eliminar</button>
                          </td>
                        </>
                      )}
                    </tr>
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
