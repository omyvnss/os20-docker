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
import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { Os20SecretsModule } from 'src/engine/core-modules/os20-secrets/os20-secrets.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { ThrottlerModule } from 'src/engine/core-modules/throttler/throttler.module';

@Module({
  imports: [
    ThrottlerModule,
    TypeOrmModule.forFeature([AiProviderKeyEntity]),
    TokenModule,
    WorkspaceCacheStorageModule,
    Os20SecretsModule,
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
