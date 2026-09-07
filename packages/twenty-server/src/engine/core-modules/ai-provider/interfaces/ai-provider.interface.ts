export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'ollama'
  | 'groq';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  tools?: Tool[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  providerOptions?: Record<string, unknown>;
}

export interface CompletionResponse {
  id: string;
  model: string;
  provider: ProviderId;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content-filter';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | {
      type: 'tool_call';
      toolCallId: string;
      toolName: string;
      argsDelta: string;
    }
  | {
      type: 'finish';
      usage: CompletionResponse['usage'];
      finishReason: string;
    }
  | { type: 'error'; error: Error };

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderId;
  contextLength?: number;
  supportsTools?: boolean;
  supportsImages?: boolean;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  supports(model: string): boolean;
  resolveModel(model: string): string;
  generate(request: CompletionRequest, apiKey?: string): Promise<CompletionResponse>;
  stream(
    request: CompletionRequest,
    apiKey?: string,
  ): AsyncIterable<StreamEvent>;
  isAvailable(apiKey?: string): Promise<boolean>;
  listModels(apiKey?: string): Promise<ModelInfo[]>;
}
