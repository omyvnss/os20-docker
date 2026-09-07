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
export class OpenAIProvider implements AIProvider {
  readonly id: ProviderId = 'openai';
  readonly name = 'OpenAI';
  private readonly logger = new Logger(OpenAIProvider.name);

  supports(model: string): boolean {
    return (
      model.startsWith('openai/') ||
      model.startsWith('gpt-') ||
      model.startsWith('o1') ||
      model.startsWith('o3') ||
      model.startsWith('o4')
    );
  }

  resolveModel(model: string): string {
    if (model.startsWith('openai/')) {
      return model.slice(7);
    }
    return model;
  }

  private getClient(apiKey?: string): OpenAI {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key not configured');
    }
    return new OpenAI({ apiKey: key });
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

      if (choice?.delta?.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          yield {
            type: 'tool_call',
            toolCallId: toolCall.id || '',
            toolName: toolCall.function?.name || '',
            argsDelta: toolCall.function?.arguments || '',
          };
        }
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
      await client.models.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    try {
      const client = this.getClient(apiKey);
      const response = await client.models.list();

      return response.data
        .filter(
          (m) =>
            m.id.startsWith('gpt-') ||
            m.id.startsWith('o1') ||
            m.id.startsWith('o3') ||
            m.id.startsWith('o4'),
        )
        .map((m) => ({
          id: m.id,
          name: m.id,
          provider: this.id as ProviderId,
          supportsTools: !m.id.startsWith('o1'),
          supportsImages: m.id.startsWith('gpt-'),
        }));
    } catch {
      return this.getDefaultModels();
    }
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: this.id,
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: this.id,
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'o3',
        name: 'o3',
        provider: this.id,
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        provider: this.id,
        supportsTools: true,
        supportsImages: false,
      },
      {
        id: 'o4-mini',
        name: 'o4-mini',
        provider: this.id,
        supportsTools: true,
        supportsImages: false,
      },
    ];
  }
}
