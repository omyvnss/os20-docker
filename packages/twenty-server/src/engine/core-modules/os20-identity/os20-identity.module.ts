import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Os20IdentityEntity } from './os20-identity.entity';
import { LocalIdentityService } from './os20-identity.service';

@Module({
  imports: [TypeOrmModule.forFeature([Os20IdentityEntity])],
  providers: [LocalIdentityService],
  exports: [LocalIdentityService],
})
export class Os20IdentityModule {}
