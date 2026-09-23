import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { Os20UpdatesController } from 'src/engine/core-modules/os20-updates/os20-updates.controller';
import { Os20UpdatesService } from 'src/engine/core-modules/os20-updates/services/os20-updates.service';
import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [TokenModule, WorkspaceCacheStorageModule, SecureHttpClientModule],
  controllers: [Os20UpdatesController],
  providers: [Os20UpdatesService],
  exports: [Os20UpdatesService],
})
export class Os20UpdatesModule {}
