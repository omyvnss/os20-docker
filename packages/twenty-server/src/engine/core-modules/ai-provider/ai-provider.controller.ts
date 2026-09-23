import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AiProviderService } from './ai-provider.service';
import { ApiKeyService } from './services/api-key.service';
import {
  type CompletionRequest,
  type ProviderId,
} from './interfaces/ai-provider.interface';

import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { Os20RateLimit } from 'src/engine/core-modules/os20-rate-limit/os20-rate-limit.guard';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

const PROVIDER_IDS: ProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'groq',
  'ollama',
];

const isProviderId = (value: string): value is ProviderId =>
  (PROVIDER_IDS as string[]).includes(value);

const MAX_COMPLETION_MESSAGES = 200;

const parseCompletionRequest = (body: unknown): CompletionRequest => {
  const request = body as Partial<CompletionRequest> | undefined;

  if (typeof request?.model !== 'string' || request.model.trim() === '') {
    throw new BadRequestException('model must be a model id');
  }

  if (
    !Array.isArray(request.messages) ||
    request.messages.length === 0 ||
    request.messages.length > MAX_COMPLETION_MESSAGES ||
    !request.messages.every(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        typeof message.role === 'string',
    )
  ) {
    throw new BadRequestException(
      `messages must be a list of 1 to ${MAX_COMPLETION_MESSAGES} messages`,
    );
  }

  if (request.tools !== undefined && !Array.isArray(request.tools)) {
    throw new BadRequestException('tools must be a list');
  }

  for (const field of ['temperature', 'max_tokens'] as const) {
    if (request[field] !== undefined && typeof request[field] !== 'number') {
      throw new BadRequestException(`${field} must be a number`);
    }
  }

  return request as CompletionRequest;
};

@Controller('ai-provider')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class AiProviderController {
  constructor(
    private readonly aiProviderService: AiProviderService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Get('providers')
  async getProviders() {
    return this.aiProviderService.getProviderStatus();
  }

  @Get('models')
  async getModels() {
    return this.aiProviderService.listModels();
  }

  @Os20RateLimit({ name: 'ai-complete', max: 30, windowMs: 60_000 })
  @Post('complete')
  async complete(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body() body: unknown,
  ) {
    return this.aiProviderService.complete(
      parseCompletionRequest(body),
      workspace.id,
    );
  }

  @Post('keys/:provider')
  async setKey(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('provider') provider: string,
    @Body() body: { key?: unknown },
  ) {
    const key = typeof body?.key === 'string' ? body.key.trim() : '';

    if (!isProviderId(provider) || !key) {
      throw new BadRequestException('Unknown provider or empty key');
    }

    await this.apiKeyService.setKey(workspace.id, provider, key);

    return { success: true };
  }

  @Delete('keys/:provider')
  async deleteKey(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('provider') provider: string,
  ) {
    if (!isProviderId(provider)) {
      throw new BadRequestException('Unknown provider');
    }

    await this.apiKeyService.deleteKey(workspace.id, provider);

    return { success: true };
  }

  @Get('keys')
  async getKeys(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.apiKeyService.getKeys(workspace.id);
  }
}
