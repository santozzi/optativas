import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pdf_records')
export class PdfRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  filename!: string;

  @Column()
  originalName!: string;

  // ── Header ──
  @Column({ nullable: true })
  lu!: string;

  @Column({ nullable: true })
  nombre!: string;

  @Column({ nullable: true })
  documento!: string;

  @Column({ nullable: true })
  inscripcion!: string;

  @Column({ nullable: true })
  carrera!: string;

  @Column({ nullable: true })
  orientacion!: string;

  @Column({ nullable: true })
  plan!: string;

  // ── Materias optativas pedidas ──
  // Array JSON: [{materia, codigo, fechaPedido, plan}]
  @Column({ type: 'text', nullable: true })
  materiasJson!: string;

  // ── Anuales (materias genéricas por año/periodo) ──
  // Array JSON: [{año, periodoLectivo, generica: [{código, tipo, carrera, plan, materia}]}]
  @Column({ type: 'text', nullable: true })
  anualesJson!: string;

  @Column({ default: false })
  procesado!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}