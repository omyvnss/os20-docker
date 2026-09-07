import { Injectable, Logger } from '@nestjs/common';

import {
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ModelInfo,
  type ProviderId,
  type StreamEvent,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private providers = new Map<ProviderId, AIProvider>();

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    this.logger.log(`Registered AI provider: ${provider.name}`);
  }

  resolve(model: string): AIProvider {
    const prefix = model.split('/')[0] as ProviderId;

    if (this.providers.has(prefix)) {
      return this.providers.get(prefix)!;
    }

    for (const provider of this.providers.values()) {
      if (provider.supports(model)) {
        return provider;
      }
    }

    throw new Error(`No provider found for model: ${model}`);
  }

  getProvider(id: ProviderId): AIProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableProviders(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  async complete(
    request: CompletionRequest,
    apiKey?: string,
  ): Promise<CompletionResponse> {
    const provider = this.resolve(request.model);
    return provider.generate(request);
  }

  async *stream(
    request: CompletionRequest,
    apiKey?: string,
  ): AsyncIterable<StreamEvent> {
    const provider = this.resolve(request.model);
    yield* provider.stream(request);
  }

  async listAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];

    for (const provider of this.providers.values()) {
      try {
        const models = await provider.listModels();
        allModels.push(...models);
      } catch (error) {
        this.logger.warn(
          `Failed to list models for ${provider.name}: ${error}`,
        );
      }
    }

    return allModels;
  }
}
