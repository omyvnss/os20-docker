import { Controller, Get, Post, Body, Param } from '@nestjs/common';

import { AiProviderService } from './ai-provider.service';
import { ApiKeyService } from './services/api-key.service';
import {
  type CompletionRequest,
  type ProviderId,
} from './interfaces/ai-provider.interface';

@Controller('ai-provider')
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

  @Post('complete')
  async complete(
    @Body() body: CompletionRequest & { workspaceId?: string },
  ) {
    const { workspaceId, ...request } = body;
    return this.aiProviderService.complete(request, workspaceId);
  }

  @Post('keys/:workspaceId/:provider')
  async setKey(
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: ProviderId,
    @Body() body: { key: string },
  ) {
    await this.apiKeyService.setKey(workspaceId, provider, body.key);
    return { success: true };
  }

  @Get('keys/:workspaceId')
  async getKeys(@Param('workspaceId') workspaceId: string) {
    return this.apiKeyService.getKeys(workspaceId);
  }
}
