import { Injectable, Logger } from '@nestjs/common';

import { AiLeadScoringService } from './ai-lead-scoring.service';
import { LeadPersistenceService } from './lead-persistence.service';
import { normalizeDomain } from '../utils/lead-candidate.util';
import {
  type OutreachContext,
  type OutreachDraft,
  type OutreachTone,
} from '../utils/outreach-prompt.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export class OutreachPersonNotFoundError extends Error {
  constructor() {
    super('Person not found');
  }
}

export type PersonOutreachResult = OutreachDraft & {
  personId: string;
  companyId?: string;
};

@Injectable()
export class PersonOutreachService {
  private readonly logger = new Logger(PersonOutreachService.name);

  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly leadPersistenceService: LeadPersistenceService,
    private readonly aiLeadScoringService: AiLeadScoringService,
  ) {}

  async generate(
    workspaceId: string,
    personId: string,
    tone?: OutreachTone,
  ): Promise<PersonOutreachResult> {
    const { person, company } =
      await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
        const personRepository = this.workspaceOrmManager.getRepository(
          PersonWorkspaceEntity,
          { shouldBypassPermissionChecks: true },
        );
        const foundPerson = await personRepository.findOne({
          where: { id: personId },
        });

        if (!foundPerson?.companyId) {
          return { person: foundPerson, company: null };
        }

        const companyRepository = this.workspaceOrmManager.getRepository(
          CompanyWorkspaceEntity,
          { shouldBypassPermissionChecks: true },
        );

        return {
          person: foundPerson,
          company: await companyRepository.findOne({
            where: { id: foundPerson.companyId },
          }),
        };
      }, buildSystemAuthContext(workspaceId));

    if (!person) {
      throw new OutreachPersonNotFoundError();
    }

    const companyWebsite = company?.domainName?.primaryLinkUrl || undefined;

    const context: OutreachContext = {
      firstName: person.name?.firstName || undefined,
      lastName: person.name?.lastName || undefined,
      jobTitle: person.jobTitle || undefined,
      companyName: company?.name || undefined,
      companyWebsite,
      companyDescription: await this.findCompanyDescription(companyWebsite),
    };

    const draft = await this.aiLeadScoringService.generatePersonOutreach(
      workspaceId,
      context,
      tone,
    );

    return {
      personId,
      ...(company?.id && { companyId: company.id }),
      ...draft,
    };
  }

  // Descriptions only live on the saved lead the company came from.
  private async findCompanyDescription(website: string | undefined) {
    const domain = normalizeDomain(website);

    if (!domain) {
      return undefined;
    }

    try {
      const leads = await this.leadPersistenceService.list();
      const lead = leads.find(
        (candidate) =>
          (candidate.domain && normalizeDomain(candidate.domain) === domain) ||
          normalizeDomain(candidate.companyUrl) === domain,
      );

      return lead?.description?.trim() || undefined;
    } catch (error) {
      this.logger.debug(`Saved lead lookup failed: ${error}`);

      return undefined;
    }
  }
}
