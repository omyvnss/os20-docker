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
    // Tables come from the CreateOs20CoreTables instance command, which has
    // not run yet when a fresh database boots. Resolution is retried lazily,
    // so never crash the boot here: fall back to ephemeral IDs and let the
    // request-time provisioning path converge.
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
  }

  getWorkspaceId(): string {
    return this.workspaceId ?? process.env.OS20_DEFAULT_WORKSPACE_ID ?? '';
  }

  getUserId(): string {
    return this.userId ?? process.env.OS20_DEFAULT_USER_ID ?? '';
  }

  // Called at request time, once the core tables exist (fresh installs only
  // reach module init before migrations).
  async ensureResolved(): Promise<void> {
    try {
      this.workspaceId = await this.resolveWorkspaceId();
      this.userId = await this.resolveUserId();
    } catch (error) {
      this.logger.warn(
        `OS20 identity re-resolution failed: ${(error as Error).message}`,
      );
    }
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
}
