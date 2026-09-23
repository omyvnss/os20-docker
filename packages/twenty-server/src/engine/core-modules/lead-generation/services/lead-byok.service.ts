import { Injectable } from '@nestjs/common';

import { ProviderRegistry } from 'src/engine/core-modules/ai-provider/registry/provider.registry';
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
  { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
  { provider: 'openai', model: 'gpt-4o-mini' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'anthropic', model: 'claude-haiku-4-5' },
  { provider: 'google', model: 'gemini-2.5-flash-lite' },
];

@Injectable()
export class LeadByokService {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly localIdentity: LocalIdentityService,
    private readonly providerRegistry: ProviderRegistry,
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

  async resolve(forWorkspaceId?: string): Promise<ByokContext | null> {
    const workspaceId = forWorkspaceId || (await this.resolveWorkspaceId());
    if (!workspaceId) {
      return null;
    }

    for (const pref of PREFERENCE) {
      const apiKey = await this.apiKeyService.getKey(
        workspaceId,
        pref.provider,
      );
      if (apiKey) {
        return {
          provider: pref.provider,
          model: pref.model,
          apiKey,
          workspaceId,
        };
      }
    }

    // Keyless fallback: the first model pulled into a local Ollama.
    const [ollamaModel] =
      (await this.providerRegistry.getProvider('ollama')?.listModels()) ?? [];

    return ollamaModel
      ? {
          provider: 'ollama',
          model: `ollama/${ollamaModel.id}`,
          apiKey: '',
          workspaceId,
        }
      : null;
  }
}
