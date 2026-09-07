import { Injectable, Logger } from '@nestjs/common';

import { GoogleGenerativeAI } from '@google/generative-ai';

import {
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ModelInfo,
  type ProviderId,
  type StreamEvent,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class GoogleProvider implements AIProvider {
  readonly id: ProviderId = 'google';
  readonly name = 'Google Gemini';
  private readonly logger = new Logger(GoogleProvider.name);

  supports(model: string): boolean {
    return (
      model.startsWith('google/') ||
      model.startsWith('gemini-')
    );
  }

  resolveModel(model: string): string {
    if (model.startsWith('google/')) {
      return model.slice(7);
    }
    return model;
  }

  private getClient(apiKey?: string): GoogleGenerativeAI {
    const key = apiKey || process.env.GOOGLE_API_KEY;
    if (!key) {
      throw new Error('Google API key not configured');
    }
    return new GoogleGenerativeAI(key);
  }

  async generate(
    request: CompletionRequest,
    apiKey?: string,
  ): Promise<CompletionResponse> {
    const genAI = this.getClient(apiKey);
    const startTime = Date.now();

    const model = genAI.getGenerativeModel({
      model: this.resolveModel(request.model),
    });

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const userMessages = request.messages.filter((m) => m.role !== 'system');

    const chat = model.startChat({
      history: userMessages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : '' }],
      })),
      systemInstruction: systemMessage
        ? typeof systemMessage.content === 'string'
          ? systemMessage.content
          : undefined
        : undefined,
    });

    const lastMessage = userMessages[userMessages.length - 1];
    const result = await chat.sendMessage(
      typeof lastMessage?.content === 'string' ? lastMessage.content : '',
    );
    const response = result.response;
    const latencyMs = Date.now() - startTime;

    return {
      id: `gemini-${Date.now()}`,
      model: this.resolveModel(request.model),
      provider: this.id,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.text(),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0,
      },
      latency_ms: latencyMs,
    };
  }

  async *stream(
    request: CompletionRequest,
    apiKey?: string,
  ): AsyncIterable<StreamEvent> {
    const genAI = this.getClient(apiKey);

    const model = genAI.getGenerativeModel({
      model: this.resolveModel(request.model),
    });

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const userMessages = request.messages.filter((m) => m.role !== 'system');

    const chat = model.startChat({
      history: userMessages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : '' }],
      })),
      systemInstruction: systemMessage
        ? typeof systemMessage.content === 'string'
          ? systemMessage.content
          : undefined
        : undefined,
    });

    const lastMessage = userMessages[userMessages.length - 1];
    const result = await chat.sendMessageStream(
      typeof lastMessage?.content === 'string' ? lastMessage.content : '',
    );

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: 'text', text };
      }
    }

    const finalResponse = await result.response;

    yield {
      type: 'finish',
      usage: {
        prompt_tokens: finalResponse.usageMetadata?.promptTokenCount || 0,
        completion_tokens:
          finalResponse.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: finalResponse.usageMetadata?.totalTokenCount || 0,
      },
      finishReason: 'stop',
    };
  }

  async isAvailable(apiKey?: string): Promise<boolean> {
    try {
      const genAI = this.getClient(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await model.generateContent('hi');
      return true;
    } catch {
      return false;
    }
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    return [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: this.id,
        contextLength: 1000000,
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: this.id,
        contextLength: 1000000,
        supportsTools: true,
        supportsImages: true,
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: this.id,
        contextLength: 1000000,
        supportsTools: true,
        supportsImages: true,
      },
    ];
  }
}
