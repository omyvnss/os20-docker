import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Repository } from 'typeorm';

import { WebSearchApiCredentialEntity } from './web-search-api.entity';
import { LocalIdentityService } from 'src/engine/core-modules/os20-identity/os20-identity.service';

export type WebSearchApiDto = {
  id: string;
  provider: string;
  apiKey: string;
  createdAt: Date;
};

@Injectable()
export class WebSearchApiService implements OnModuleInit {
  private readonly logger = new Logger(WebSearchApiService.name);
  private readonly algorithm = 'aes-256-cbc';

  constructor(
    private readonly localIdentityService: LocalIdentityService,
    @InjectRepository(WebSearchApiCredentialEntity)
    private readonly credentialRepository: Repository<WebSearchApiCredentialEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.credentialRepository.manager.query(`
        CREATE TABLE IF NOT EXISTS core.web_search_api_credentials (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "workspaceId" varchar NOT NULL,
          "provider" varchar NOT NULL,
          "encryptedApiKey" text NOT NULL,
          "iv" varchar,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_web_search_api_credentials" PRIMARY KEY ("id")
        )
      `);
    } catch (error) {
      this.logger.warn('Web search API table creation failed', error);
    }
  }

  private getEncryptionKey(): Buffer {
    const key =
      process.env.PGDB_ENCRYPTION_KEY ||
      'os20-default-key-change-in-production-32b';

    return Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf-8');
  }

  private encrypt(text: string): { encrypted: string; iv: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');

    encrypted += cipher.final('hex');

    return { encrypted, iv: iv.toString('hex') };
  }

  private decrypt(encrypted: string, iv: string): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.getEncryptionKey(),
      Buffer.from(iv, 'hex'),
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');

    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  async list(): Promise<WebSearchApiDto[]> {
    const credentials = await this.credentialRepository.find({
      where: { workspaceId: this.localIdentityService.getWorkspaceId() },
      order: { createdAt: 'ASC' },
    });

    return credentials.map((credential) => ({
      id: credential.id,
      provider: credential.provider,
      apiKey: this.decrypt(
        credential.encryptedApiKey,
        credential.iv ?? '',
      ),
      createdAt: credential.createdAt,
    }));
  }

  async create(input: {
    provider: string;
    apiKey: string;
  }): Promise<WebSearchApiDto> {
    const { encrypted, iv } = this.encrypt(input.apiKey);

    const credential = this.credentialRepository.create({
      workspaceId: this.localIdentityService.getWorkspaceId(),
      provider: input.provider.trim(),
      encryptedApiKey: encrypted,
      iv,
    });

    await this.credentialRepository.save(credential);

    return {
      id: credential.id,
      provider: credential.provider,
      apiKey: input.apiKey,
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