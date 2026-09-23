import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { Os20IdentityModule } from 'src/engine/core-modules/os20-identity/os20-identity.module';
import { Os20SecretsModule } from 'src/engine/core-modules/os20-secrets/os20-secrets.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WebSearchApiCredentialEntity } from './web-search-api.entity';
import { WebSearchApiService } from './web-search-api.service';
import { WebSearchApiController } from './web-search-api.controller';
import { WebSearchToolService } from './services/web-search-tool.service';
import { WebScrapeToolService } from './services/web-scrape-tool.service';
import { WebContactFinderService } from './services/web-contact-finder.service';
import { GooglePlacesService } from './services/google-places.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebSearchApiCredentialEntity]),
    Os20IdentityModule,
    TokenModule,
    WorkspaceCacheStorageModule,
    Os20SecretsModule,
  ],
  controllers: [WebSearchApiController],
  providers: [
    WebSearchApiService,
    WebSearchToolService,
    WebScrapeToolService,
    WebContactFinderService,
    GooglePlacesService,
  ],
  exports: [
    WebSearchApiService,
    WebSearchToolService,
    WebScrapeToolService,
    WebContactFinderService,
    GooglePlacesService,
  ],
})
export class WebSearchApisModule {}
