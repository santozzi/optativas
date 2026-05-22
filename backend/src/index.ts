import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { DataSource } from 'typeorm';
import { PdfRecord } from './entities/PdfRecord';
import pdfRoutes from './routes/pdfRoutes';
import testRoutes from './routes/testRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// ── Database ──
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'pdfuser',
  password: process.env.DB_PASS || 'pdfpass',
  database: process.env.DB_NAME || 'promedb',
  synchronize: true,
  logging: false,
  entities: [PdfRecord],
});

// ── Routes ──
app.use('/api', pdfRoutes);
app.use('/api', testRoutes);

// ── Start ──
AppDataSource.initialize()
  .then(() => {
    console.log('Database connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });