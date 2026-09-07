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

@Injectable()
export class OllamaProvider implements AIProvider {
  readonly id: ProviderId = 'ollama';
  readonly name = 'Ollama (Local)';
  private readonly logger = new Logger(OllamaProvider.name);

  supports(model: string): boolean {
    return model.startsWith('ollama/');
  }

  resolveModel(model: string): string {
    if (model.startsWith('ollama/')) {
      return model.slice(7);
    }
    return model;
  }

  private getClient(apiKey?: string): OpenAI {
    const baseUrl =
      process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
    return new OpenAI({
      apiKey: 'ollama',
      baseURL: `${baseUrl}/v1`,
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
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    });

    const latencyMs = Date.now() - startTime;

    return {
      id: response.id || `ollama-${Date.now()}`,
      model: response.model || request.model,
      provider: this.id,
      choices: response.choices.map((choice) => ({
        index: choice.index,
        message: {
          role: 'assistant' as const,
          content: choice.message?.content || '',
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
      const baseUrl =
        process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    try {
      const baseUrl =
        process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      const data = await response.json();

      return (data.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        provider: this.id as ProviderId,
        supportsTools: false,
        supportsImages: false,
      }));
    } catch {
      return [];
    }
  }
}
