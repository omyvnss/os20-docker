import { Module } from '@nestjs/common';

import { Os20SecretCipherService } from 'src/engine/core-modules/os20-secrets/os20-secret-cipher.service';
import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';

@Module({
  imports: [SecretEncryptionModule],
  providers: [Os20SecretCipherService],
  exports: [Os20SecretCipherService],
})
export class Os20SecretsModule {}
