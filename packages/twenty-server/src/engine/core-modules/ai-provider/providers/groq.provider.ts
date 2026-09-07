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
export class GroqProvider implements AIProvider {
  readonly id: ProviderId = 'groq';
  readonly name = 'Groq';
  private readonly logger = new Logger(GroqProvider.name);

  supports(model: string): boolean {
    return model.startsWith('groq/');
  }

  resolveModel(model: string): string {
    if (model.startsWith('groq/')) {
      return model.slice(5);
    }
    return model;
  }

  private getClient(apiKey?: string): OpenAI {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error('Groq API key not configured');
    }
    return new OpenAI({
      apiKey: key,
      baseURL: 'https://api.groq.com/openai/v1',
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
    return [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        provider: this.id,
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: this.id,
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        provider: this.id,
        supportsTools: false,
        supportsImages: false,
      },
    ];
  }
}
