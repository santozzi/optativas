import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pdf_records')
export class PdfRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  filename!: string;

  @Column()
  originalName!: string;

  @Column({ nullable: true })
  apellidoNombre!: string;

  @Column({ nullable: true })
  lu!: string;

  @Column({ nullable: true })
  codigoCarrera!: string;

  @Column({ nullable: true })
  plan!: string;

  @Column({ nullable: true })
  codigoMateria!: string;

  @Column({ nullable: true })
  genericaAsociada!: string;

  @Column({ default: false })
  procesado!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}