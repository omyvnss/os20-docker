import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { ImapSmtpCaldavModule } from 'src/engine/core-modules/imap-smtp-caldav-connection/imap-smtp-caldav-connection.module';
import { Os20EmailSendEntity } from 'src/engine/core-modules/os20-email/entities/os20-email-send.entity';
import { Os20EmailSettingsEntity } from 'src/engine/core-modules/os20-email/entities/os20-email-settings.entity';
import { Os20EmailController } from 'src/engine/core-modules/os20-email/os20-email.controller';
import { Os20EmailNoteService } from 'src/engine/core-modules/os20-email/services/os20-email-note.service';
import { Os20EmailService } from 'src/engine/core-modules/os20-email/services/os20-email.service';
import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { ConnectedAccountMetadataModule } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.module';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountTokenEncryptionModule } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { IMAPAPIsModule } from 'src/modules/connected-account/imap-api/imap-apis.module';
import { MessagingSendManagerModule } from 'src/modules/messaging/message-outbound-manager/messaging-send-manager.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Os20EmailSettingsEntity,
      Os20EmailSendEntity,
      ConnectedAccountEntity,
    ]),
    TokenModule,
    WorkspaceCacheStorageModule,
    ConnectedAccountMetadataModule,
    ConnectedAccountTokenEncryptionModule,
    ImapSmtpCaldavModule,
    IMAPAPIsModule,
    ToolModule,
    MessagingSendManagerModule,
  ],
  controllers: [Os20EmailController],
  providers: [Os20EmailService, Os20EmailNoteService],
})
export class Os20EmailModule {}
