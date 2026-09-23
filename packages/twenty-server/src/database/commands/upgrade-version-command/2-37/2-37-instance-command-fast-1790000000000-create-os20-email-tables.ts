import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.37.0', 1790000000000)
export class CreateOs20EmailTablesFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."os20_email_settings" (
        "workspaceId" varchar NOT NULL,
        "connectedAccountId" uuid,
        "dailyLimit" integer NOT NULL DEFAULT 30,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_os20_email_settings" PRIMARY KEY ("workspaceId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."os20_email_sends" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" varchar NOT NULL,
        "kind" varchar NOT NULL,
        "personId" uuid,
        "connectedAccountId" uuid,
        "toEmail" varchar NOT NULL,
        "subject" text NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_os20_email_sends" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_os20_email_sends_workspace_created"
        ON "core"."os20_email_sends" ("workspaceId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "core"."os20_email_sends"');
    await queryRunner.query('DROP TABLE IF EXISTS "core"."os20_email_settings"');
  }
}
