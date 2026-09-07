import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Os20IdentityModule } from 'src/engine/core-modules/os20-identity/os20-identity.module';
import { WebAgentConnectionEntity } from './web-agent.entity';
import { WebAgentService } from './web-agent.service';
import { WebAgentController } from './web-agent.controller';
import { WebAgentToolProvider } from './web-agent-tool.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebAgentConnectionEntity]),
    Os20IdentityModule,
  ],
  controllers: [WebAgentController],
  providers: [WebAgentService, WebAgentToolProvider],
  exports: [WebAgentService, WebAgentToolProvider],
})
export class WebAgentModule {}