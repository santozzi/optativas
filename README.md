# Proyecto PDF - Extracción de Datos de Inscripción

Sistema fullstack para procesar comprobantes de inscripción a materias optativas de la Universidad Nacional del Sur (UNS).

## Tech Stack

- **Backend:** Node.js + TypeScript + TypeORM + PostgreSQL
- **Frontend:** React + Vite
- **OCR:** qpdf + pdftotext + Ghostscript + Tesseract
- **Docker:** docker-compose

## Getting Started

### Opción 1: Docker (Recomendado)

```bash
docker compose up -d
```

Acceder a: `http://localhost:3002`

### Opción 2: Desarrollo local

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

## Uso

1. **Subir PDFs:** Arrastrar o seleccionar archivos PDF al área de upload
2. **Editar datos:** Click en "Editar" para modificar campos manualmente
3. **Re-procesar OCR:** Click en "OCR" para re-extraer datos con OCR
4. **Exportar Excel:** Click en "Exportar Excel" para descargar todos los datos

### Datos Extraídos

- **Apellido y Nombre**: Nombre completo del alumno
- **LU**: Libreta Universitaria
- **Código Carrera**: Código de la carrera (ej: 155 para Medicina)
- **Plan**: Plan de estudios (ej: 2023/1)
- **Código Materia**: Código(s) de materia(s) optativa(s) pedida(s)
- **Genérica Asociada**: Código(s) de matería(s) genérica(s) asociada(s)

## Estructura del Proyecto

```
proyecto-pdf/
├── backend/
│   ├── src/
│   │   ├── entities/     # Entidades TypeORM
│   │   ├── services/    # Lógica OCR
│   │   └── index.ts    # API servidor
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx     # Componente principal
│   │   └── main.tsx    # Entry point
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Puertos

- **3001**: Backend API
- **3002**: Frontend
- **5432**: PostgreSQL

## Notas

- Los PDFs de la UNS pueden tener restricciones -> se usan qpdf para desbloquearlos
- Algunos PDFs son imágenes -> se usa OCR con Tesseract
- Los datos se guardan en PostgreSQL y se pueden exportar a Excel