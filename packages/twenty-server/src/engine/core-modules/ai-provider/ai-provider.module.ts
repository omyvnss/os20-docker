import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyService } from './services/api-key.service';
import { AiProviderController } from './ai-provider.controller';
import { AiProviderService } from './ai-provider.service';
import { ProviderRegistry } from './registry/provider.registry';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { AiProviderKeyEntity } from './entities/ai-provider-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiProviderKeyEntity]),
  ],
  controllers: [AiProviderController],
  providers: [
    AiProviderService,
    ProviderRegistry,
    ApiKeyService,
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider,
    OpenRouterProvider,
    GroqProvider,
    OllamaProvider,
  ],
  exports: [AiProviderService, ProviderRegistry, ApiKeyService],
})
export class AiProviderModule {}
