import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AiProviderKeyEntity } from '../entities/ai-provider-key.entity';
import { type ProviderId } from '../interfaces/ai-provider.interface';
import { Os20SecretCipherService } from 'src/engine/core-modules/os20-secrets/os20-secret-cipher.service';

const INSTANCE_KEYS_TTL_MS = 30_000;

@Injectable()
export class ApiKeyService implements OnModuleInit {
  private instanceKeys = new Map<string, string>();
  private instanceKeysLoadedAt = 0;

  constructor(
    @InjectRepository(AiProviderKeyEntity)
    private readonly keyRepository: Repository<AiProviderKeyEntity>,
    private readonly secretCipher: Os20SecretCipherService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshInstanceKeys();
  }

  async setKey(
    workspaceId: string,
    provider: ProviderId,
    key: string,
  ): Promise<void> {
    const existing = await this.keyRepository.findOne({
      where: { workspaceId, provider },
    });

    const { encrypted, iv } = this.secretCipher.encrypt(key, workspaceId);

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

    await this.refreshInstanceKeys();
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

    return this.secretCipher.decrypt(
      entity.encryptedKey,
      entity.iv,
      entity.workspaceId,
    );
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

  async deleteKey(workspaceId: string, provider: ProviderId): Promise<void> {
    await this.keyRepository.delete({ workspaceId, provider });
    await this.refreshInstanceKeys();
  }

  // OS20 runs one workspace per install, so a saved key makes that provider's
  // catalog models available instance-wide. The TTL lets the worker process
  // pick up keys saved through the server.
  getInstanceKeys(): Map<string, string> {
    if (Date.now() - this.instanceKeysLoadedAt > INSTANCE_KEYS_TTL_MS) {
      void this.refreshInstanceKeys();
    }

    return this.instanceKeys;
  }

  private async refreshInstanceKeys(): Promise<void> {
    this.instanceKeysLoadedAt = Date.now();

    try {
      const entities = await this.keyRepository.find({
        where: { isActive: true },
        order: { updatedAt: 'DESC' },
      });
      const keys = new Map<string, string>();

      for (const entity of entities) {
        if (keys.has(entity.provider)) {
          continue;
        }

        try {
          keys.set(
            entity.provider,
            this.secretCipher.decrypt(
              entity.encryptedKey,
              entity.iv,
              entity.workspaceId,
            ),
          );
        } catch {
          // Stored with a different encryption key; the user must re-save it.
        }
      }

      this.instanceKeys = keys;
    } catch {
      // core.ai_provider_keys does not exist until the upgrade command has run.
    }
  }
}
