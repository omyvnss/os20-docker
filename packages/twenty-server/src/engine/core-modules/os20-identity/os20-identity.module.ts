import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';

import { DefaultLocalWorkspaceProvisioner } from './default-workspace-provisioner.service';
import { Os20IdentityEntity } from './os20-identity.entity';
import { LocalIdentityService } from './os20-identity.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Os20IdentityEntity,
      WorkspaceEntity,
      UserEntity,
      UserWorkspaceEntity,
    ]),
    WorkspaceModule,
    ApplicationModule,
  ],
  providers: [LocalIdentityService, DefaultLocalWorkspaceProvisioner],
  exports: [LocalIdentityService],
})
export class Os20IdentityModule {}