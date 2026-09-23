import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ContactDiscoveryService,
  MAX_BULK_COMPANIES,
} from './services/contact-discovery.service';
import { ContactPersistenceService } from './services/contact-persistence.service';
import { OutreachAiUnavailableError } from './services/ai-lead-scoring.service';
import { LeadGenerationService } from './services/lead-generation.service';
import { LeadPersistenceService } from './services/lead-persistence.service';
import { LeadSourcesService } from './services/lead-sources.service';
import {
  OutreachPersonNotFoundError,
  PersonOutreachService,
} from './services/person-outreach.service';
import { isOutreachTone } from './utils/outreach-prompt.util';
import {
  type IdealCustomerProfile,
  type Lead,
} from './interfaces/lead-generation.interface';
import { type LeadSourceCriteria } from './interfaces/lead-source.interface';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { Os20RateLimit } from 'src/engine/core-modules/os20-rate-limit/os20-rate-limit.guard';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseCompanyIds = (companyIds: unknown): string[] => {
  if (
    !Array.isArray(companyIds) ||
    companyIds.length === 0 ||
    !companyIds.every((id) => typeof id === 'string' && UUID_PATTERN.test(id))
  ) {
    throw new BadRequestException('companyIds must be a non-empty uuid list');
  }

  if (companyIds.length > MAX_BULK_COMPANIES) {
    throw new BadRequestException(
      `At most ${MAX_BULK_COMPANIES} companies per request`,
    );
  }

  return companyIds as string[];
};

const MAX_BULK_OUTREACH = 25;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLeadInput = (value: unknown): boolean =>
  isPlainObject(value) &&
  typeof value.company === 'string' &&
  value.company.trim().length > 0;

const parseIcp = (icp: unknown): IdealCustomerProfile => {
  if (icp === undefined) {
    return {};
  }

  if (!isPlainObject(icp)) {
    throw new BadRequestException('icp must be an object');
  }

  return icp as IdealCustomerProfile;
};

const parseModel = (model: unknown): string | undefined => {
  if (model !== undefined && typeof model !== 'string') {
    throw new BadRequestException('model must be a string');
  }

  return model;
};

@Controller('lead-generation')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class LeadGenerationController {
  constructor(
    private readonly leadGenService: LeadGenerationService,
    private readonly leadSourcesService: LeadSourcesService,
    private readonly leadPersistenceService: LeadPersistenceService,
  ) {}

  @Get('sources')
  async getSources() {
    return this.leadSourcesService.getCatalog();
  }

  @Get('leads')
  async getSavedLeads(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.leadPersistenceService.list(workspace.id);
  }

  @Post('leads/clean')
  async cleanSavedLeads(@AuthWorkspace() workspace: WorkspaceEntity) {
    const { total, removed } = await this.leadPersistenceService.clean(
      workspace.id,
    );

    return { success: true, total, removed };
  }

  @Delete('leads/:key')
  async removeSavedLead(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('key') key: string,
  ) {
    const removed = await this.leadPersistenceService.remove(workspace.id, key);

    if (!removed) {
      throw new NotFoundException('Lead not found');
    }

    return { success: true };
  }

  @Os20RateLimit({ name: 'lead-sources-search', max: 30, windowMs: 60_000 })
  @Post('sources-search')
  async searchSource(@Body() body: { sourceId?: unknown; criteria?: unknown }) {
    if (typeof body?.sourceId !== 'string' || !isPlainObject(body.criteria)) {
      throw new BadRequestException(
        'sourceId must be a string and criteria an object',
      );
    }

    const { sourceId } = body;
    const criteria = body.criteria as LeadSourceCriteria;

    // Source failures (blocked scrape, bad criteria) are user-actionable: return
    // the reason instead of a generic 500.
    try {
      return await this.leadSourcesService.search(sourceId, criteria);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  @Os20RateLimit({ name: 'lead-find', max: 10, windowMs: 60_000 })
  @Post('find')
  async findLeads(@Body() body: { icp?: unknown }) {
    const result = await this.leadGenService.findLeads(parseIcp(body?.icp));

    return { success: true, totalFound: result.leads.length, ...result };
  }

  @Os20RateLimit({ name: 'lead-outreach', max: 30, windowMs: 60_000 })
  @Post('outreach')
  async generateOutreach(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body()
    body: {
      personId?: unknown;
      tone?: unknown;
      lead?: unknown;
      icp?: unknown;
      model?: unknown;
    },
  ) {
    if (body?.personId === undefined && body?.lead !== undefined) {
      if (!isLeadInput(body.lead)) {
        throw new BadRequestException('lead must include a company name');
      }

      const message = await this.leadGenService.generateOutreach(
        body.lead as unknown as Lead,
        parseIcp(body.icp),
        parseModel(body.model),
      );

      return { success: true, message };
    }

    if (
      typeof body?.personId !== 'string' ||
      !UUID_PATTERN.test(body.personId)
    ) {
      throw new BadRequestException('personId must be a uuid');
    }

    if (body.tone !== undefined && !isOutreachTone(body.tone)) {
      throw new BadRequestException('tone must be short, friendly or formal');
    }

    try {
      const draft = await this.personOutreachService.generate(
        workspace.id,
        body.personId,
        body.tone,
      );

      return { success: true, ...draft };
    } catch (error) {
      if (error instanceof OutreachPersonNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof OutreachAiUnavailableError) {
        throw new BadRequestException(error.message);
      }

      throw new BadRequestException(
        `Could not draft outreach: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Os20RateLimit({ name: 'lead-outreach-bulk', max: 5, windowMs: 60_000 })
  @Post('outreach/bulk')
  async generateBulkOutreach(
    @Body()
    body: { leads?: unknown; icp?: unknown; model?: unknown },
  ) {
    if (
      !Array.isArray(body?.leads) ||
      body.leads.length === 0 ||
      !body.leads.every(isLeadInput)
    ) {
      throw new BadRequestException(
        'leads must be a non-empty list of leads with a company name',
      );
    }

    if (body.leads.length > MAX_BULK_OUTREACH) {
      throw new BadRequestException(
        `At most ${MAX_BULK_OUTREACH} leads per request`,
      );
    }

    const results = await this.leadGenService.generateBulkOutreach(
      body.leads as unknown as Lead[],
      parseIcp(body.icp),
      parseModel(body.model),
    );

    return {
      success: true,
      totalGenerated: results.length,
      messages: results,
    };
  }

  @Inject(ContactDiscoveryService)
  private readonly contactDiscoveryService: ContactDiscoveryService;

  @Inject(ContactPersistenceService)
  private readonly contactPersistenceService: ContactPersistenceService;

  @Inject(PersonOutreachService)
  private readonly personOutreachService: PersonOutreachService;

  @Os20RateLimit({ name: 'lead-contacts', max: 20, windowMs: 60_000 })
  @Post('contacts')
  async discoverContacts(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body() body: { companyIds?: unknown },
  ) {
    const results = await this.contactDiscoveryService.discoverForCompanyIds(
      workspace.id,
      parseCompanyIds(body?.companyIds),
    );

    return { success: true, results };
  }

  @Os20RateLimit({ name: 'lead-contacts-save', max: 20, windowMs: 60_000 })
  @Post('contacts/save')
  async saveContacts(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body() body: { companyIds?: unknown },
  ) {
    const results =
      await this.contactPersistenceService.discoverAndSaveForCompanyIds(
        workspace.id,
        parseCompanyIds(body?.companyIds),
      );

    return { success: true, results };
  }
}
