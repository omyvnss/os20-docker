import { Injectable } from '@nestjs/common';

import { KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';
import { KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';

import type { Lead } from '../interfaces/lead-generation.interface';
import { LeadByokService } from './lead-byok.service';

// Single JSONB value per workspace holding all saved leads. Well-defined,
// migration-free persistence backstopped by the core key/value store.
const SAVED_KEY = 'leadGen:savedLeads:v1';

@Injectable()
export class LeadPersistenceService {
  constructor(
    private readonly keyValuePairService: KeyValuePairService,
    private readonly byok: LeadByokService,
  ) {}

  async list(): Promise<Lead[]> {
    const workspaceId = await this.byok.resolveWorkspaceId();
    if (!workspaceId) {
      return [];
    }

    const rows = await this.keyValuePairService.get<{ value: Lead[] }>({
      workspaceId,
      key: SAVED_KEY,
      type: KeyValuePairType.USER_VARIABLE,
    });

    const value = rows[0]?.value;
    if (!Array.isArray(value)) {
      return [];
    }

    return value as Lead[];
  }

  async save(leads: Lead[]): Promise<Lead[]> {
    const workspaceId = await this.byok.resolveWorkspaceId();
    if (!workspaceId || !leads.length) {
      return leads;
    }

    const merged = await this.merge(leads, await this.list());

    await this.keyValuePairService.set({
      workspaceId,
      key: SAVED_KEY,
      type: KeyValuePairType.USER_VARIABLE,
      value: merged,
    });

    return merged;
  }

  private async merge(incoming: Lead[], existing: Lead[]): Promise<Lead[]> {
    const byUrl = new Map<string, Lead>();

    for (const lead of existing) {
      byUrl.set(`${lead.workspaceId ?? ''}:${lead.companyUrl}`, lead);
    }
    for (const lead of incoming) {
      byUrl.set(`${lead.workspaceId ?? ''}:${lead.companyUrl}`, lead);
    }

    return Array.from(byUrl.values()).sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    );
  }
}