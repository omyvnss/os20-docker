import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Repository } from 'typeorm';

import { AiProviderKeyEntity } from '../entities/ai-provider-key.entity';
import { type ProviderId } from '../interfaces/ai-provider.interface';

@Injectable()
export class ApiKeyService implements OnModuleInit {
  private readonly algorithm = 'aes-256-cbc';

  constructor(
    @InjectRepository(AiProviderKeyEntity)
    private readonly keyRepository: Repository<AiProviderKeyEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTableExists();
  }

  private async ensureTableExists(): Promise<void> {
    try {
      await this.keyRepository.manager.query(`
        CREATE TABLE IF NOT EXISTS core.ai_provider_keys (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "workspaceId" varchar NOT NULL,
          "provider" varchar NOT NULL,
          "encryptedKey" text NOT NULL,
          "iv" varchar,
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_ai_provider_keys" PRIMARY KEY ("id")
        )
      `);
    } catch (error) {
      // Table creation is best-effort; the repository will surface real errors.
    }
  }

  private getEncryptionKey(): Buffer {
    const key = process.env.PGDB_ENCRYPTION_KEY || 'os20-default-key-change-in-production-32b';
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

  async setKey(
    workspaceId: string,
    provider: ProviderId,
    key: string,
  ): Promise<void> {
    const existing = await this.keyRepository.findOne({
      where: { workspaceId, provider },
    });

    const { encrypted, iv } = this.encrypt(key);

    if (existing) {
      existing.encryptedKey = encrypted;
      existing.iv = iv;
      existing.isActive = true;
      await this.keyRepository.save(existing);
    } else {
      const entity = this.keyRepository.create({
        workspaceId,
        provider,
        encryptedKey: encrypted,
        iv,
      });
      await this.keyRepository.save(entity);
    }
  }

  async getKey(
    workspaceId: string,
    provider: ProviderId,
  ): Promise<string | null> {
    const entity = await this.keyRepository.findOne({
      where: { workspaceId, provider, isActive: true },
    });

    if (!entity) {
      return null;
    }

    return this.decrypt(entity.encryptedKey, entity.iv);
  }

  async getKeys(
    workspaceId: string,
  ): Promise<{ provider: ProviderId; hasKey: boolean }[]> {
    const entities = await this.keyRepository.find({
      where: { workspaceId },
    });

    const providers: ProviderId[] = [
      'openai',
      'anthropic',
      'google',
      'openrouter',
      'groq',
      'ollama',
    ];

    return providers.map((p) => ({
      provider: p,
      hasKey: entities.some((e) => e.provider === p && e.isActive),
    }));
  }

  async deleteKey(
    workspaceId: string,
    provider: ProviderId,
  ): Promise<void> {
    await this.keyRepository.delete({ workspaceId, provider });
  }
}
