import { Injectable, OnModuleInit } from '@nestjs/common';

import { ProviderRegistry } from './registry/provider.registry';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { ApiKeyService } from './services/api-key.service';
import {
  type CompletionRequest,
  type CompletionResponse,
  type ModelInfo,
  type ProviderId,
  type StreamEvent,
} from './interfaces/ai-provider.interface';

@Injectable()
export class AiProviderService implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly openai: OpenAIProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly google: GoogleProvider,
    private readonly openrouter: OpenRouterProvider,
    private readonly groq: GroqProvider,
    private readonly ollama: OllamaProvider,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  onModuleInit() {
    this.registry.register(this.openai);
    this.registry.register(this.anthropic);
    this.registry.register(this.google);
    this.registry.register(this.openrouter);
    this.registry.register(this.groq);
    this.registry.register(this.ollama);
  }

  async complete(
    request: CompletionRequest,
    workspaceId?: string,
  ): Promise<CompletionResponse> {
    const provider = this.registry.resolve(request.model);
    const apiKey = workspaceId
      ? await this.apiKeyService.getKey(workspaceId, provider.id)
      : undefined;

    return provider.generate(request, apiKey);
  }

  async *stream(
    request: CompletionRequest,
    workspaceId?: string,
  ): AsyncIterable<StreamEvent> {
    const provider = this.registry.resolve(request.model);
    const apiKey = workspaceId
      ? await this.apiKeyService.getKey(workspaceId, provider.id)
      : undefined;
    yield* provider.stream(request, apiKey);
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.registry.listAllModels();
  }

  async getProviderStatus(): Promise<
    { id: ProviderId; name: string; available: boolean }[]
  > {
    const providers = this.registry.getAllProviders();
    const status = await Promise.all(
      providers.map(async (p) => ({
        id: p.id,
        name: p.name,
        available: await p.isAvailable(),
      })),
    );
    return status;
  }

  getAvailableProviders(): ProviderId[] {
    return this.registry.getAvailableProviders();
  }
}
