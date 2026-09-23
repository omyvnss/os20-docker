import { Module } from '@nestjs/common';

import { LeadGenerationController } from './lead-generation.controller';
import { LeadGenerationService } from './services/lead-generation.service';
import { WebSearchService } from './services/web-search.service';
import { CompanyScraperService } from './services/company-scraper.service';
import { AiLeadScoringService } from './services/ai-lead-scoring.service';
import { LeadEnrichmentService } from './services/lead-enrichment.service';
import { LeadByokService } from './services/lead-byok.service';
import { LeadPersistenceService } from './services/lead-persistence.service';
import { LeadSourcesService } from './services/lead-sources.service';
import { ContactDiscoveryService } from './services/contact-discovery.service';
import { ContactPersistenceService } from './services/contact-persistence.service';
import { PersonOutreachService } from './services/person-outreach.service';
import { AiProviderModule } from 'src/engine/core-modules/ai-provider/ai-provider.module';
import { WebAgentModule } from 'src/engine/core-modules/web-agent/web-agent.module';
import { Os20IdentityModule } from 'src/engine/core-modules/os20-identity/os20-identity.module';
import { KeyValuePairModule } from 'src/engine/core-modules/key-value-pair/key-value-pair.module';
import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { WebSearchApisModule } from 'src/engine/core-modules/web-search-apis/web-search-api.module';
import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { ThrottlerModule } from 'src/engine/core-modules/throttler/throttler.module';

@Module({
  imports: [
    ThrottlerModule,
    AiProviderModule,
    WebAgentModule,
    Os20IdentityModule,
    KeyValuePairModule,
    TokenModule,
    WorkspaceCacheStorageModule,
    SecureHttpClientModule,
    WebSearchApisModule,
  ],
  controllers: [LeadGenerationController],
  providers: [
    LeadGenerationService,
    WebSearchService,
    CompanyScraperService,
    AiLeadScoringService,
    LeadSourcesService,
    LeadEnrichmentService,
    LeadByokService,
    LeadPersistenceService,
    ContactDiscoveryService,
    ContactPersistenceService,
    PersonOutreachService,
  ],
  exports: [
    LeadGenerationService,
    LeadSourcesService,
    ContactDiscoveryService,
    ContactPersistenceService,
  ],
})
export class LeadGenerationModule {}
