import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { Os20IdentityModule } from 'src/engine/core-modules/os20-identity/os20-identity.module';
import { Os20SecretsModule } from 'src/engine/core-modules/os20-secrets/os20-secrets.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WebAgentConnectionEntity } from './web-agent.entity';
import { WebAgentService } from './web-agent.service';
import { WebAgentController } from './web-agent.controller';
import { WebAgentToolProvider } from './web-agent-tool.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebAgentConnectionEntity]),
    Os20IdentityModule,
    TokenModule,
    WorkspaceCacheStorageModule,
    Os20SecretsModule,
  ],
  controllers: [WebAgentController],
  providers: [WebAgentService, WebAgentToolProvider],
  exports: [WebAgentService, WebAgentToolProvider],
})
export class WebAgentModule {}