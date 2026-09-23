import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('os20_email_settings')
export class Os20EmailSettingsEntity {
  @PrimaryColumn({ type: 'varchar' })
  workspaceId: string;

  @Column({ type: 'uuid', nullable: true })
  connectedAccountId: string | null;

  @Column({ type: 'integer', default: 30 })
  dailyLimit: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
