import { Injectable } from '@nestjs/common';

import { createDecipheriv } from 'crypto';

import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';

const LEGACY_FALLBACK_KEY = 'os20-default-key-change-in-production-32b';
const MASK = '••••••••';

@Injectable()
export class Os20SecretCipherService {
  constructor(
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  encrypt(
    plaintext: string,
    workspaceId: string,
  ): { encrypted: string; iv: null } {
    return {
      encrypted: this.secretEncryptionService.encryptVersioned(
        plaintext as PlaintextString,
        { workspaceId },
      ),
      iv: null,
    };
  }

  // Rows written before the enc:v2 switch carry an IV and used AES-256-CBC.
  decrypt(encrypted: string, iv: string | null, workspaceId: string): string {
    if (iv) {
      return this.decryptLegacyCbc(encrypted, iv);
    }

    return this.secretEncryptionService.decryptVersionedOrThrow(
      encrypted as EncryptedString,
      { workspaceId },
    );
  }

  mask(plaintext: string): string {
    return this.secretEncryptionService.maskDecryptedValue(plaintext, MASK);
  }

  private decryptLegacyCbc(encrypted: string, iv: string): string {
    const rawKey = process.env.PGDB_ENCRYPTION_KEY || LEGACY_FALLBACK_KEY;
    const key = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf-8');
    const decipher = createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(iv, 'hex'),
    );

    return decipher.update(encrypted, 'hex', 'utf-8') + decipher.final('utf-8');
  }
}
