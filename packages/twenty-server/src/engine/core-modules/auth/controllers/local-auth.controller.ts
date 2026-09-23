import { Controller, Get, Req, Res } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { type Request, type Response } from 'express';
import { type DataSource, type QueryRunner, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { RefreshTokenService } from 'src/engine/core-modules/auth/token/services/refresh-token.service';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { LocalIdentityService } from 'src/engine/core-modules/os20-identity/os20-identity.service';
import { Os20RateLimit } from 'src/engine/core-modules/os20-rate-limit/os20-rate-limit.guard';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

// Exact match so rebinding hosts like `localhost.attacker.com` are rejected.
// Host is client-controlled, so the real boundary is publishing the port on
// 127.0.0.1 only (see docker-compose.yml). OS20_ALLOWED_HOSTS adds hostnames
// for a reverse proxy that already authenticates its users.
const ALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  ...(process.env.OS20_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
]);

const toOrigin = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return undefined;
  }
};

// The zero-login token must never be readable by another website open in the
// same browser: a page on evil.example can call localhost because the user's
// own browser sends the request. Browsers mark such requests with
// Sec-Fetch-Site and Origin, and the custom header forces a preflight.
export const isSameOriginLocalRequest = (req: Request): boolean => {
  if (req.headers['x-os20-local'] !== '1') {
    return false;
  }

  const fetchSite = req.headers['sec-fetch-site'];

  if (fetchSite === 'cross-site' || fetchSite === 'same-site') {
    return false;
  }

  const origin = req.headers.origin;

  if (origin === undefined) {
    return true;
  }

  const requestOrigin = toOrigin(`${req.protocol}://${req.headers.host ?? ''}`);
  const allowedOrigins = new Set(
    [
      requestOrigin,
      toOrigin(process.env.SERVER_URL),
      toOrigin(process.env.FRONT_BASE_URL),
    ].filter((value): value is string => value !== undefined),
  );

  return allowedOrigins.has(origin.toLowerCase());
};

@Controller('auth')
export class LocalAuthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
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

  @Os20RateLimit({ name: 'local-token', max: 60, windowMs: 60_000 })
  @Get('local-token')
  async getLocalToken(@Req() req: Request, @Res() res: Response) {
    const hostname = (req.headers.host ?? '')
      .toLowerCase()
      .replace(/:\d+$/, '');
    const isLocalhost = ALLOWED_HOSTNAMES.has(hostname);
    const skipAuth = process.env.SKIP_AUTH === 'true';

    if (!isLocalhost || !skipAuth || !isSameOriginLocalRequest(req)) {
      res.removeHeader('Access-Control-Allow-Origin');
      res.removeHeader('Access-Control-Allow-Credentials');

      return res.status(403).json({ error: 'Local auth not available' });
    }

    await this.ensureDefaultWorkspace();

    const userId = this.localIdentityService.getUserId();
    const workspaceId = this.localIdentityService.getWorkspaceId();

    const token = await this.accessTokenService.generateAccessToken({
      userId,
      workspaceId,
      authProvider: AuthProviderEnum.Password,
    });

    // A real refresh token lets the app renew the 30-minute access token
    // instead of dropping the user back to the welcome page.
    const refreshToken = await this.refreshTokenService.generateRefreshToken({
      userId,
      workspaceId,
      authProvider: AuthProviderEnum.Password,
      targetedTokenType: JwtTokenTypeEnum.ACCESS,
    });

    return res.json({
      token: token.token,
      expiresAt: token.expiresAt,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.expiresAt,
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
        isEmailVerified: true,
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
