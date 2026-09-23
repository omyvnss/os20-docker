import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// OS20 custom tables, previously created ad hoc at module init. IF NOT EXISTS
// keeps this safe on installs where the old boot code already created them.
@RegisteredInstanceCommand('2.36.0', 1787900000000)
export class CreateOs20CoreTablesFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."os20_identity" (
        "key" varchar PRIMARY KEY,
        "value" text NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."ai_provider_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "encryptedKey" text NOT NULL,
        "iv" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_provider_keys" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."web_search_api_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "encryptedApiKey" text NOT NULL,
        "iv" varchar,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_web_search_api_credentials" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."web_agent_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" varchar NOT NULL,
        "name" varchar NOT NULL,
        "baseUrl" text NOT NULL,
        "encryptedKey" text NOT NULL,
        "iv" varchar,
        "allowPrivateNetwork" boolean NOT NULL DEFAULT false,
        "enabled" boolean NOT NULL DEFAULT true,
        "capabilities" text,
        "lastTestedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_web_agent_connections" PRIMARY KEY ("id")
      )
    `);

    // OS20 ships with no default model until the user picks one.
    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
        ALTER COLUMN "smartModel" DROP NOT NULL,
        ALTER COLUMN "smartModel" SET DEFAULT NULL,
        ALTER COLUMN "fastModel" DROP NOT NULL,
        ALTER COLUMN "fastModel" SET DEFAULT NULL,
        ALTER COLUMN "useRecommendedModels" SET DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
        ALTER COLUMN "useRecommendedModels" SET DEFAULT true
    `);
    await queryRunner.query('DROP TABLE IF EXISTS "core"."web_agent_connections"');
    await queryRunner.query(
      'DROP TABLE IF EXISTS "core"."web_search_api_credentials"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "core"."ai_provider_keys"');
    await queryRunner.query('DROP TABLE IF EXISTS "core"."os20_identity"');
  }
}
