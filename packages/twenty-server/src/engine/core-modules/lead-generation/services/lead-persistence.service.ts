import { Injectable, Logger } from '@nestjs/common';

import { KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';
import { KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';

import type { Lead } from '../interfaces/lead-generation.interface';
import { cleanLeads, getLeadKey } from '../utils/lead-quality.util';
import { LeadByokService } from './lead-byok.service';

// Single JSONB value per workspace holding all saved leads. Well-defined,
// migration-free persistence backstopped by the core key/value store.
const SAVED_KEY = 'leadGen:savedLeads:v1';
const MAX_SAVED_LEADS = 500;

// Bump when the save-time rules change so stored rows are cleaned once more.
export const SAVED_LEADS_CLEANUP_VERSION = 2;

// Legacy payloads are a bare array; cleaned ones carry the rule version.
type StoredLeads = { cleanupVersion: number; leads: Lead[] };

export type LeadCleanupResult = {
  total: number;
  removed: number;
  leads: Lead[];
};

export const readStoredLeads = (
  value: unknown,
): { leads: unknown[]; cleanupVersion: number } => {
  if (Array.isArray(value)) {
    return { leads: value, cleanupVersion: 0 };
  }

  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as StoredLeads).leads)
  ) {
    const { leads, cleanupVersion } = value as StoredLeads;

    return {
      leads,
      cleanupVersion: Number.isFinite(cleanupVersion) ? cleanupVersion : 0,
    };
  }

  return { leads: [], cleanupVersion: 0 };
};

@Injectable()
export class LeadPersistenceService {
  private readonly logger = new Logger(LeadPersistenceService.name);

  constructor(
    private readonly keyValuePairService: KeyValuePairService,
    private readonly byok: LeadByokService,
  ) {}

  // Runs the one-time cleanup lazily the first time a workspace reads its
  // leads after the rules changed.
  async list(workspaceId?: string): Promise<Lead[]> {
    const resolvedWorkspaceId =
      workspaceId ?? (await this.byok.resolveWorkspaceId());

    if (!resolvedWorkspaceId) {
      return [];
    }

    const stored = await this.read(resolvedWorkspaceId);

    if (stored.cleanupVersion >= SAVED_LEADS_CLEANUP_VERSION) {
      return stored.leads as Lead[];
    }

    const { leads, removed } = cleanLeads(stored.leads);

    try {
      await this.write(resolvedWorkspaceId, leads);
      this.logger.log(
        `Cleaned saved leads for workspace ${resolvedWorkspaceId}: ${removed} removed, ${leads.length} kept`,
      );
    } catch (error) {
      this.logger.warn(`Could not store cleaned leads: ${error}`);
    }

    return leads;
  }

  async clean(workspaceId: string): Promise<LeadCleanupResult> {
    const stored = await this.read(workspaceId);
    const { leads, removed } = cleanLeads(stored.leads);

    await this.write(workspaceId, leads);

    return { total: leads.length, removed, leads };
  }

  async save(leads: Lead[]): Promise<Lead[]> {
    const workspaceId = await this.byok.resolveWorkspaceId();
    if (!workspaceId || !leads.length) {
      return leads;
    }

    const byKey = new Map<string, Lead>();

    // A lead found again replaces its stored copy.
    for (const lead of [
      ...(await this.list(workspaceId)),
      ...cleanLeads(leads).leads,
    ]) {
      byKey.set(getLeadKey(lead), lead);
    }

    const merged = [...byKey.values()]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, MAX_SAVED_LEADS);

    await this.write(workspaceId, merged);

    return merged;
  }

  async remove(workspaceId: string, key: string): Promise<boolean> {
    const leads = await this.list(workspaceId);
    const remaining = leads.filter((lead) => getLeadKey(lead) !== key);

    if (remaining.length === leads.length) {
      return false;
    }

    await this.write(workspaceId, remaining);

    return true;
  }

  private async read(workspaceId: string) {
    const rows = await this.keyValuePairService.get({
      workspaceId,
      key: SAVED_KEY,
      type: KeyValuePairType.USER_VARIABLE,
    });

    return readStoredLeads(rows[0]?.value);
  }

  private async write(workspaceId: string, leads: Lead[]) {
    const value: StoredLeads = {
      cleanupVersion: SAVED_LEADS_CLEANUP_VERSION,
      leads: leads.slice(0, MAX_SAVED_LEADS),
    };

    await this.keyValuePairService.set({
      workspaceId,
      key: SAVED_KEY,
      type: KeyValuePairType.USER_VARIABLE,
      value,
    });
  }
}
