import { Controller, Get, Req, Res } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { type Request, type Response } from 'express';
import { type DataSource, type QueryRunner, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { LocalIdentityService } from 'src/engine/core-modules/os20-identity/os20-identity.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Controller('auth')
export class LocalAuthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accessTokenService: AccessTokenService,
    private readonly localIdentityService: LocalIdentityService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceService: WorkspaceService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  @Get('local-token')
  async getLocalToken(@Req() req: Request, @Res() res: Response) {
    const host = req.headers.host || req.hostname || '';
    const isLocalhost =
      host.includes('localhost') || host.includes('127.0.0.1');
    const skipAuth = process.env.SKIP_AUTH === 'true';

    if (!isLocalhost || !skipAuth) {
      return res.status(403).json({ error: 'Local auth not available' });
    }

    await this.ensureDefaultWorkspace();

    const userId = this.localIdentityService.getUserId();
    const workspaceId = this.localIdentityService.getWorkspaceId();

    const token = await this.accessTokenService.generateAccessToken({
      userId,
      workspaceId,
      authProvider: 'os20-local',
    });

    return res.json({
      token: token.token,
      expiresAt: token.expiresAt,
      user: {
        id: userId,
        email: 'admin@os20.local',
        firstName: 'Admin',
        lastName: 'User',
      },
      workspace: {
        id: workspaceId,
        displayName: 'OS20',
      },
    });
  }

  private async ensureDefaultWorkspace() {
    await this.localIdentityService.ensureResolved();

    const workspaceId = this.localIdentityService.getWorkspaceId();
    const userId = this.localIdentityService.getUserId();

    const existingWorkspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (
      existingWorkspace &&
      existingWorkspace.activationStatus !==
        WorkspaceActivationStatus.PENDING_CREATION &&
      existingWorkspace.activationStatus !==
        WorkspaceActivationStatus.ONGOING_CREATION
    ) {
      return;
    }

    if (existingWorkspace) {
      await this.completeProvisioning();
    } else {
      await this.provisionFromScratch();
    }
  }

  private async completeProvisioning() {
    const workspaceId = this.localIdentityService.getWorkspaceId();
    const userId = this.localIdentityService.getUserId();

    const workspace = await this.workspaceRepository.findOneByOrFail({
      id: workspaceId,
    });
    const authUser = this.buildAuthContextUser(userId);

    await this.workspaceService.activateWorkspace(authUser, workspace);
  }

  private async provisionFromScratch() {
    const workspaceId = this.localIdentityService.getWorkspaceId();
    const userId = this.localIdentityService.getUserId();
    const workspaceCustomApplicationId = v4();

    // The workspace and its workspace-custom application hold circular FKs
    // (workspace.workspaceCustomApplicationId -> application.id, and
    // application.workspaceId -> workspace.id), so both must be created in a
    // single transaction, mirroring the real signup path.
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
      const workspace = await queryRunner.manager.save(
        WorkspaceEntity,
        workspaceToCreate,
      );

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

    // Run the full provisioning pipeline (metadata schema, standard objects,
    // default/admin roles, activation) synchronously, same as the GraphQL
    // activateWorkspace mutation.
    await this.completeProvisioning();
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
