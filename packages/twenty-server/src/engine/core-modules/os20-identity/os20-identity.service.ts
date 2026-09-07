import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { DefaultLocalWorkspaceProvisioner } from './default-workspace-provisioner.service';
import { Os20IdentityEntity } from './os20-identity.entity';

type IdentityKey = 'workspace' | 'user';

/**
 * Single-user identity resolution for the local, zero-auth mode.
 *
 * On first boot it adopts the already-provisioned workspace and admin user when
 * present (so upgrades keep their data), and otherwise generates stable UUIDs
 * that are persisted so the API and worker processes agree. No personal or
 * install-specific identifiers are hardcoded in the source; IDs can be pinned
 * explicitly via env for deterministic installs.
 */
@Injectable()
export class LocalIdentityService implements OnModuleInit {
  private readonly logger = new Logger(LocalIdentityService.name);

  private workspaceId?: string;
  private userId?: string;

  constructor(
    @InjectRepository(Os20IdentityEntity)
    private readonly identityRepository: Repository<Os20IdentityEntity>,
    @Optional() private readonly provisioner?: DefaultLocalWorkspaceProvisioner,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.identityRepository.manager.query(`
        CREATE TABLE IF NOT EXISTS core.os20_identity (
          "key" varchar PRIMARY KEY,
          "value" text NOT NULL
        )
      `);
    } catch (error) {
      this.logger.warn('OS20 identity table creation failed', error);
    }

    // On a fresh database the core tables (core.workspace, core."user") do
    // not exist yet at module init (the boot migration phase only creates the
    // schemas/extensions). Resolution is retried lazily, so never crash the
    // boot here — fall back to ephemeral IDs and let the request-time
    // provisioning path converge.
    try {
      this.workspaceId = await this.resolveWorkspaceId();
      this.userId = await this.resolveUserId();
    } catch (error) {
      this.logger.warn(
        `OS20 identity resolution deferred (pre-migration boot): ${(error as Error).message}`,
      );
      this.workspaceId = randomUUID();
      this.userId = randomUUID();
    }

    await this.ensureNoDefaultModelSchema();
  }

  getWorkspaceId(): string {
    return (
      this.workspaceId ?? process.env.OS20_DEFAULT_WORKSPACE_ID ?? ''
    );
  }

  getUserId(): string {
    return this.userId ?? process.env.OS20_DEFAULT_USER_ID ?? '';
  }

  // Called at request time, once the core tables exist (fresh installs only
  // reach module init before migrations; this converges identity + schema so
  // provisioning can insert the no-default-model workspace).
  async ensureResolved(): Promise<void> {
    try {
      this.workspaceId = await this.resolveWorkspaceId();
      this.userId = await this.resolveUserId();
    } catch (error) {
      this.logger.warn(
        `OS20 identity re-resolution failed: ${(error as Error).message}`,
      );
    }

    await this.ensureNoDefaultModelSchema();
  }

  private async resolveWorkspaceId(): Promise<string> {
    const fromEnv = process.env.OS20_DEFAULT_WORKSPACE_ID;

    if (fromEnv) {
      return fromEnv;
    }

    const recorded = await this.identityRepository.findOne({
      where: { key: 'workspace' },
    });

    if (recorded && (await this.workspaceExists(recorded.value))) {
      return recorded.value;
    }

    const existing = await this.identityRepository.manager.query(
      `SELECT id FROM core.workspace WHERE "deletedAt" IS NULL ORDER BY "createdAt" LIMIT 2`,
    );

    if (existing.length > 0) {
      await this.identityRepository.save({
        key: 'workspace',
        value: existing[0].id,
      });

      return existing[0].id;
    }

    // No workspace at all (fresh install). Provision the default local
    // workspace + admin user now so API-only flows work before the browser
    // touches the app, instead of resolving to a phantom workspace UUID.
    if (this.provisioner) {
      const { workspaceId, userId } =
        await this.provisioner.ensureProvisionsDefaultWorkspace();

      this.userId = userId;

      await this.identityRepository.save([
        { key: 'workspace', value: workspaceId },
        { key: 'user', value: userId },
      ]);

      return workspaceId;
    }

    return this.generateAndRecord('workspace');
  }

  private async resolveUserId(): Promise<string> {
    const fromEnv = process.env.OS20_DEFAULT_USER_ID;

    if (fromEnv) {
      return fromEnv;
    }

    const recorded = await this.identityRepository.findOne({
      where: { key: 'user' },
    });

    if (recorded && (await this.userExists(recorded.value))) {
      return recorded.value;
    }

    const workspaceId = this.getWorkspaceId();

    if (workspaceId) {
      const linked = await this.identityRepository.manager.query(
        `SELECT "userId" FROM core."userWorkspace"
         WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
         ORDER BY "createdAt" LIMIT 1`,
        [workspaceId],
      );

      if (linked.length > 0) {
        await this.identityRepository.save({
          key: 'user',
          value: linked[0].userId,
        });

        return linked[0].userId;
      }
    }

    return this.generateAndRecord('user');
  }

  private async workspaceExists(id: string): Promise<boolean> {
    const rows = await this.identityRepository.manager.query(
      `SELECT 1 FROM core.workspace WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [id],
    );

    return rows.length > 0;
  }

  private async userExists(id: string): Promise<boolean> {
    const rows = await this.identityRepository.manager.query(
      `SELECT 1 FROM core."user" WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [id],
    );

    return rows.length > 0;
  }

  private async generateAndRecord(key: IdentityKey): Promise<string> {
    const value = randomUUID();

    await this.identityRepository.save({ key, value });

    return value;
  }

  // ponytail: idempotent runtime schema convergence so fresh installs get
  // "no default model until the user picks". Replaced by a proper versioned
  // migration in the publish pass. Safe to run on every boot.
  private async ensureNoDefaultModelSchema(): Promise<void> {
    try {
      await this.identityRepository.manager.query(`
        ALTER TABLE core.workspace
          ALTER COLUMN "smartModel" DROP NOT NULL,
          ALTER COLUMN "smartModel" SET DEFAULT NULL,
          ALTER COLUMN "fastModel" DROP NOT NULL,
          ALTER COLUMN "fastModel" SET DEFAULT NULL,
          ALTER COLUMN "useRecommendedModels" SET DEFAULT false
      `);
    } catch (error) {
      this.logger.warn('OS20 workspace model schema convergence failed', error);
    }
  }
}
