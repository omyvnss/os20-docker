import { Injectable } from '@nestjs/common';

import { ApiKeyService } from 'src/engine/core-modules/ai-provider/services/api-key.service';
import type { ProviderId } from 'src/engine/core-modules/ai-provider/interfaces/ai-provider.interface';
import { LocalIdentityService } from 'src/engine/core-modules/os20-identity/os20-identity.service';

export interface ByokContext {
  provider: ProviderId;
  model: string;
  apiKey: string;
  workspaceId: string;
}

// Preferred BYOK provider + default model order. Providers the OS20 lead-gen
// pipeline can call to run AI (scoring, outreach, extraction).
const PREFERENCE: { provider: ProviderId; model: string }[] = [
  { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
  { provider: 'openai', model: 'gpt-4o-mini' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
];

@Injectable()
export class LeadByokService {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly localIdentity: LocalIdentityService,
  ) {}

  get workspaceId(): string {
    return this.localIdentity.getWorkspaceId();
  }

  // Offline identity resolution can leave getWorkspaceId() empty on a fresh
  // boot (core tables aren't ready at module init). Resolve a valid workspace
  // id defensively so BYOK lookup + persistence always have a real key.
  async resolveWorkspaceId(): Promise<string> {
    let id = this.localIdentity.getWorkspaceId();

    if (!id) {
      await this.localIdentity.ensureResolved();
      id = this.localIdentity.getWorkspaceId();
    }

    return id;
  }

  async resolve(): Promise<ByokContext | null> {
    const workspaceId = await this.resolveWorkspaceId();
    if (!workspaceId) {
      return null;
    }

    for (const pref of PREFERENCE) {
      const apiKey = await this.apiKeyService.getKey(workspaceId, pref.provider);
      if (apiKey) {
        return {
          provider: pref.provider,
          model: pref.model,
          apiKey,
          workspaceId,
        };
      }
    }

    return null;
  }
}