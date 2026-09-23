import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { WebSearchApiCredentialEntity } from './web-search-api.entity';
import { LocalIdentityService } from 'src/engine/core-modules/os20-identity/os20-identity.service';
import { Os20SecretCipherService } from 'src/engine/core-modules/os20-secrets/os20-secret-cipher.service';
import {
  normalizeProvider,
  toWebSearchApiProviderId,
  WEB_SEARCH_API_PROVIDER_IDS,
} from './constants/web-search-api-providers.constant';

export type WebSearchApiDto = {
  id: string;
  provider: string;
  apiKey: string;
  createdAt: Date;
};

@Injectable()
export class WebSearchApiService {
  constructor(
    private readonly localIdentityService: LocalIdentityService,
    @InjectRepository(WebSearchApiCredentialEntity)
    private readonly credentialRepository: Repository<WebSearchApiCredentialEntity>,
    private readonly secretCipher: Os20SecretCipherService,
  ) {}

  // Masked keys for the settings UI. Server-side tools use listWithSecrets.
  async list(): Promise<WebSearchApiDto[]> {
    const credentials = await this.listWithSecrets();

    return credentials.map((credential) => ({
      ...credential,
      apiKey: this.secretCipher.mask(credential.apiKey),
    }));
  }

  async listWithSecrets(): Promise<WebSearchApiDto[]> {
    const credentials = await this.credentialRepository.find({
      where: { workspaceId: this.localIdentityService.getWorkspaceId() },
      order: { createdAt: 'ASC' },
    });

    return credentials.map((credential) => ({
      id: credential.id,
      provider: credential.provider,
      apiKey: this.secretCipher.decrypt(
        credential.encryptedApiKey,
        credential.iv,
        credential.workspaceId,
      ),
      createdAt: credential.createdAt,
    }));
  }

  // Newest saved key for one provider, decrypted for server-side use only.
  async getApiKey(provider: string): Promise<string | undefined> {
    const credentials = await this.listWithSecrets();
    const matches = credentials.filter(
      (credential) =>
        normalizeProvider(credential.provider) === normalizeProvider(provider),
    );

    return matches[matches.length - 1]?.apiKey || undefined;
  }

  async create(input: {
    provider: string;
    apiKey: string;
  }): Promise<WebSearchApiDto> {
    const provider = toWebSearchApiProviderId(String(input.provider ?? ''));
    const apiKey = String(input.apiKey ?? '').trim();

    if (!provider) {
      throw new BadRequestException(
        `Unknown provider. Use one of: ${WEB_SEARCH_API_PROVIDER_IDS.join(', ')}`,
      );
    }

    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    const workspaceId = this.localIdentityService.getWorkspaceId();
    const { encrypted, iv } = this.secretCipher.encrypt(apiKey, workspaceId);

    const credential = this.credentialRepository.create({
      workspaceId,
      provider,
      encryptedApiKey: encrypted,
      iv,
    });

    await this.credentialRepository.save(credential);

    return {
      id: credential.id,
      provider: credential.provider,
      apiKey: this.secretCipher.mask(apiKey),
      createdAt: credential.createdAt,
    };
  }

  async delete(id: string): Promise<void> {
    await this.credentialRepository.delete({
      id,
      workspaceId: this.localIdentityService.getWorkspaceId(),
    });
  }
}
