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
import { AiProviderModule } from 'src/engine/core-modules/ai-provider/ai-provider.module';
import { WebAgentModule } from 'src/engine/core-modules/web-agent/web-agent.module';
import { Os20IdentityModule } from 'src/engine/core-modules/os20-identity/os20-identity.module';
import { KeyValuePairModule } from 'src/engine/core-modules/key-value-pair/key-value-pair.module';

@Module({
  imports: [
    AiProviderModule,
    WebAgentModule,
    Os20IdentityModule,
    KeyValuePairModule,
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
  ],
  exports: [LeadGenerationService, LeadSourcesService],
})
export class LeadGenerationModule {}
