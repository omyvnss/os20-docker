import { Injectable, Logger } from '@nestjs/common';

import OpenAI from 'openai';

import {
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ModelInfo,
  type ProviderId,
  type StreamEvent,
} from '../interfaces/ai-provider.interface';
import { createOpenRouterFreeFetch } from '../utils/openrouter-free-fetch.util';

@Injectable()
export class OpenRouterProvider implements AIProvider {
  readonly id: ProviderId = 'openrouter';
  readonly name = 'OpenRouter';
  private readonly logger = new Logger(OpenRouterProvider.name);

  supports(model: string): boolean {
    return model.startsWith('openrouter/');
  }

  resolveModel(model: string): string {
    if (model.startsWith('openrouter/')) {
      return model === 'openrouter/auto' || model === 'openrouter/free'
        ? model
        : model.slice(11);
    }
    return model;
  }

  private getClient(apiKey?: string): OpenAI {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error('OpenRouter API key not configured');
    }
    return new OpenAI({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      fetch: createOpenRouterFreeFetch(),
      // Model fallback already retries across free models.
      maxRetries: 0,
      defaultHeaders: {
        'HTTP-Referer': 'https://os20.dev',
        'X-Title': 'OS20 CRM',
      },
    });
  }

  async generate(
    request: CompletionRequest,
    apiKey?: string,
  ): Promise<CompletionResponse> {
    const client = this.getClient(apiKey);
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: this.resolveModel(request.model),
      messages: request.messages as any,
      tools: request.tools as any,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    });

    const latencyMs = Date.now() - startTime;

    if (!Array.isArray(response.choices)) {
      const { error } = response as unknown as { error?: unknown };

      throw new Error(
        `OpenRouter returned no answer from any free model: ${JSON.stringify(error ?? response).slice(0, 200)}`,
      );
    }

    return {
      id: response.id,
      model: response.model,
      provider: this.id,
      choices: response.choices.map((choice) => ({
        index: choice.index,
        message: {
          role: 'assistant' as const,
          content: choice.message?.content || '',
          tool_calls: choice.message?.tool_calls as any,
        },
        finish_reason: choice.finish_reason as any,
      })),
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
      latency_ms: latencyMs,
    };
  }

  async *stream(
    request: CompletionRequest,
    apiKey?: string,
  ): AsyncIterable<StreamEvent> {
    const client = this.getClient(apiKey);

    const stream = await client.chat.completions.create({
      model: this.resolveModel(request.model),
      messages: request.messages as any,
      tools: request.tools as any,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];

      if (choice?.delta?.content) {
        yield { type: 'text', text: choice.delta.content };
      }

      if (choice?.finish_reason) {
        yield {
          type: 'finish',
          usage: {
            prompt_tokens: chunk.usage?.prompt_tokens || 0,
            completion_tokens: chunk.usage?.completion_tokens || 0,
            total_tokens: chunk.usage?.total_tokens || 0,
          },
          finishReason: choice.finish_reason,
        };
      }
    }
  }

  async isAvailable(apiKey?: string): Promise<boolean> {
    try {
      const client = this.getClient(apiKey);
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    const models: Array<{
      id: string;
      name: string;
      supportsTools: boolean;
      supportsImages: boolean;
    }> = [
      {
        id: 'nvidia/nemotron-3-super-120b-a12b:free',
        name: 'Nemotron 3 Super 120B (Free)',
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'nvidia/nemotron-3.5-lightning:free',
        name: 'Nemotron 3.5 Lightning (Free)',
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        name: 'Nemotron 3 Ultra 550B (Free)',
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'google/gemma-4-31b-it:free',
        name: 'Gemma 4 31B (Free)',
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'google/gemma-4-26b-a4b-it:free',
        name: 'Gemma 4 26B A4B (Free)',
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'poolside/laguna-s-2.1:free',
        name: 'Laguna S 2.1 (Free)',
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'cohere/north-mini-code:free',
        name: 'North Mini Code (Free)',
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'thinkingmachines/inkling:free',
        name: 'Inkling (Free)',
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'openrouter/free',
        name: 'OpenRouter Free Router (Free)',
        supportsTools: true,
        supportsImages: false,
      },
    ];

    return models.map(({ id, name, supportsTools, supportsImages }) => ({
      id,
      name: `${name} (via OpenRouter)`,
      provider: this.id,
      supportsTools,
      supportsImages,
    }));
  }
}
