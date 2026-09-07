import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('web_agent_connections')
export class WebAgentConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text' })
  baseUrl: string;

  @Column({ type: 'text' })
  encryptedKey: string;

  @Column({ type: 'varchar', nullable: true })
  iv: string;

  @Column({ type: 'boolean', default: false })
  allowPrivateNetwork: boolean;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  capabilities: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastTestedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}