import { isDefined } from 'twenty-shared/utils';

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  bedrock: 'AWS Bedrock',
  google: 'Google Gemini',
  mistral: 'Mistral',
  xai: 'xAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI-compatible',
};

export const getProviderDisplayName = (
  providerName: string | null | undefined,
): string | undefined => {
  if (!isDefined(providerName) || providerName === '') {
    return undefined;
  }

  return PROVIDER_DISPLAY_NAMES[providerName] ?? providerName;
};
