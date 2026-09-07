import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { type DataSource, type QueryRunner, type Repository } from 'typeorm';
import { v4 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

/**
 * Provisions the local, zero-auth default workspace + admin user on demand the
 * first time any request needs a workspace (idempotent afterwards). This lets
 * the API-only path (lead generation, etc.) work before the browser has
 * touched the app, instead of resolving to a phantom workspace UUID.
 */
@Injectable()
export class DefaultLocalWorkspaceProvisioner {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly applicationService: ApplicationService,
    private readonly workspaceService: WorkspaceService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  async ensureProvisionsDefaultWorkspace(
    workspaceId = v4(),
    userId = v4(),
  ): Promise<{ workspaceId: string; userId: string }> {
    const existing = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (
      existing &&
      existing.activationStatus !== WorkspaceActivationStatus.PENDING_CREATION &&
      existing.activationStatus !== WorkspaceActivationStatus.ONGOING_CREATION
    ) {
      return { workspaceId, userId };
    }

    if (existing) {
      await this.completeProvisioning(workspaceId, userId);
    } else {
      await this.provisionFromScratch(workspaceId, userId);
    }

    return { workspaceId, userId };
  }

  private async completeProvisioning(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findOneByOrFail({
      id: workspaceId,
    });

    await this.workspaceService.activateWorkspace(
      this.buildAuthContextUser(userId),
      workspace,
    );
  }

  private async provisionFromScratch(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const workspaceCustomApplicationId = v4();

    await this.dataSource.transaction(async (entityManager) => {
      const queryRunner = entityManager.queryRunner as QueryRunner;

      const workspaceToCreate = this.workspaceRepository.create({
        id: workspaceId,
        displayName: 'OS20',
        subdomain: 'os20-local',
        activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
        databaseSchema: 'public',
        workspaceCustomApplicationId,
        smartModel: null,
        fastModel: null,
        useRecommendedModels: false,
      });
      await queryRunner.manager.save(WorkspaceEntity, workspaceToCreate);

      await this.applicationService.createWorkspaceCustomApplication(
        {
          workspaceId,
          applicationId: workspaceCustomApplicationId,
        },
        queryRunner,
      );

      const user = this.userRepository.create({
        id: userId,
        email: 'admin@os20.local',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: 'local-mode-no-password',
        emailVerified: true,
        locale: 'en',
      });
      await queryRunner.manager.save(UserEntity, user);

      await queryRunner.manager.save(
        UserWorkspaceEntity,
        this.userWorkspaceRepository.create({
          userId,
          workspaceId,
          locale: 'en',
        }),
      );
    });

    await this.completeProvisioning(workspaceId, userId);
  }

  private buildAuthContextUser(userId: string): AuthContextUser {
    return {
      id: userId,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@os20.local',
      locale: 'en',
    } as AuthContextUser;
  }
}