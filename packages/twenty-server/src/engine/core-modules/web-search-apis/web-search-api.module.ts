import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Os20IdentityModule } from 'src/engine/core-modules/os20-identity/os20-identity.module';
import { WebSearchApiCredentialEntity } from './web-search-api.entity';
import { WebSearchApiService } from './web-search-api.service';
import { WebSearchApiController } from './web-search-api.controller';
import { WebSearchToolService } from './services/web-search-tool.service';
import { WebScrapeToolService } from './services/web-scrape-tool.service';
import { WebContactFinderService } from './services/web-contact-finder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebSearchApiCredentialEntity]),
    Os20IdentityModule,
  ],
  controllers: [WebSearchApiController],
  providers: [
    WebSearchApiService,
    WebSearchToolService,
    WebScrapeToolService,
    WebContactFinderService,
  ],
  exports: [
    WebSearchApiService,
    WebSearchToolService,
    WebScrapeToolService,
    WebContactFinderService,
  ],
})
export class WebSearchApisModule {}