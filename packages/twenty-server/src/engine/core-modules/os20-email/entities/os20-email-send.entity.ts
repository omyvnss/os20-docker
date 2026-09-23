import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type Os20EmailSendKind = 'outreach' | 'test';

@Entity('os20_email_sends')
export class Os20EmailSendEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  kind: Os20EmailSendKind;

  @Column({ type: 'uuid', nullable: true })
  personId: string | null;

  @Column({ type: 'uuid', nullable: true })
  connectedAccountId: string | null;

  @Column({ type: 'varchar' })
  toEmail: string;

  @Column({ type: 'text' })
  subject: string;

  @CreateDateColumn()
  createdAt: Date;
}
