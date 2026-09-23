import { type SelectOption } from 'twenty-ui/input';

export type KeyedAiProviderId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq';

export const KEYED_AI_PROVIDERS: SelectOption<KeyedAiProviderId>[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq' },
];

// Cheapest model per provider, used by POST /ai-provider/complete to test a key.
export const AI_PROVIDER_TEST_MODELS: Record<KeyedAiProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  google: 'gemini-2.5-flash-lite',
  openrouter: 'openrouter/auto',
  groq: 'groq/llama-3.3-70b-versatile',
};
