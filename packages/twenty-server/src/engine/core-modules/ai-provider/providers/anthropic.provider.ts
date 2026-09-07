import { Injectable, Logger } from '@nestjs/common';

import Anthropic from '@anthropic-ai/sdk';

import {
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ModelInfo,
  type ProviderId,
  type StreamEvent,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class AnthropicProvider implements AIProvider {
  readonly id: ProviderId = 'anthropic';
  readonly name = 'Anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);

  supports(model: string): boolean {
    return (
      model.startsWith('anthropic/') ||
      model.startsWith('claude-')
    );
  }

  resolveModel(model: string): string {
    if (model.startsWith('anthropic/')) {
      return model.slice(10);
    }
    return model;
  }

  private getClient(apiKey?: string): Anthropic {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('Anthropic API key not configured');
    }
    return new Anthropic({ apiKey: key });
  }

  async generate(
    request: CompletionRequest,
    apiKey?: string,
  ): Promise<CompletionResponse> {
    const client = this.getClient(apiKey);
    const startTime = Date.now();

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const nonSystemMessages = request.messages.filter(
      (m) => m.role !== 'system',
    );

    const response = await client.messages.create({
      model: this.resolveModel(request.model),
      max_tokens: request.max_tokens || 4096,
      system: systemMessage
        ? typeof systemMessage.content === 'string'
          ? systemMessage.content
          : ''
        : undefined,
      messages: nonSystemMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      })) as any,
      temperature: request.temperature,
    });

    const latencyMs = Date.now() - startTime;

    const textContent = response.content.find((c) => c.type === 'text');

    return {
      id: response.id,
      model: response.model,
      provider: this.id,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent?.text || '',
          },
          finish_reason:
            response.stop_reason === 'end_turn' ? 'stop' : 'length',
        },
      ],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens:
          response.usage.input_tokens + response.usage.output_tokens,
      },
      latency_ms: latencyMs,
    };
  }

  async *stream(
    request: CompletionRequest,
    apiKey?: string,
  ): AsyncIterable<StreamEvent> {
    const client = this.getClient(apiKey);

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const nonSystemMessages = request.messages.filter(
      (m) => m.role !== 'system',
    );

    const stream = client.messages.stream({
      model: this.resolveModel(request.model),
      max_tokens: request.max_tokens || 4096,
      system: systemMessage
        ? typeof systemMessage.content === 'string'
          ? systemMessage.content
          : ''
        : undefined,
      messages: nonSystemMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      })) as any,
      temperature: request.temperature,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as any;
        if (delta.text) {
          yield { type: 'text', text: delta.text };
        }
      }
    }

    const finalMessage = await stream.finalMessage();

    yield {
      type: 'finish',
      usage: {
        prompt_tokens: finalMessage.usage.input_tokens,
        completion_tokens: finalMessage.usage.output_tokens,
        total_tokens:
          finalMessage.usage.input_tokens +
          finalMessage.usage.output_tokens,
      },
      finishReason:
        finalMessage.stop_reason === 'end_turn' ? 'stop' : 'length',
    };
  }

  async isAvailable(apiKey?: string): Promise<boolean> {
    try {
      const client = this.getClient(apiKey);
      await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: this.id,
        contextLength: 200000,
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: this.id,
        contextLength: 200000,
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: this.id,
        contextLength: 200000,
        supportsTools: true,
        supportsImages: true,
      },
    ];
  }
}
