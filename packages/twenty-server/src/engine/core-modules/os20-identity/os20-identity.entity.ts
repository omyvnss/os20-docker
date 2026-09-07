import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('os20_identity')
export class Os20IdentityEntity {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'text' })
  value: string;
}
