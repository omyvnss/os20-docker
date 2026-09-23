import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ConnectedAccountProvider } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { ImapSmtpCaldavService } from 'src/engine/core-modules/imap-smtp-caldav-connection/services/imap-smtp-caldav-connection.service';
import { EmailConnectionSecurity } from 'src/engine/core-modules/imap-smtp-caldav-connection/enums/email-connection-security.enum';
import {
  type Os20EmailSendKind,
  Os20EmailSendEntity,
} from 'src/engine/core-modules/os20-email/entities/os20-email-send.entity';
import { Os20EmailSettingsEntity } from 'src/engine/core-modules/os20-email/entities/os20-email-settings.entity';
import { Os20EmailNoteService } from 'src/engine/core-modules/os20-email/services/os20-email-note.service';
import {
  OS20_EMAIL_DEFAULT_DAILY_LIMIT,
  Os20EmailValidationError,
  type Os20SendInput,
  type Os20SmtpInput,
  getRecipientRefusal,
  plainTextToHtml,
  startOfUtcDay,
  toConnectionSecurity,
} from 'src/engine/core-modules/os20-email/utils/os20-email-rules.util';
import { EmailComposerService } from 'src/engine/core-modules/tool/tools/email-tool/email-composer.service';
import { ConnectedAccountMetadataService } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountTokenEncryptionService } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { ImapSmtpCalDavAPIService } from 'src/modules/connected-account/services/imap-smtp-caldav-apis.service';
import { SendEmailService } from 'src/modules/messaging/message-outbound-manager/services/send-email.service';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export type Os20EmailErrorCode =
  | 'NO_SENDER'
  | 'PERSON_NOT_FOUND'
  | 'NO_EMAIL'
  | 'INVALID_EMAIL'
  | 'NEEDS_CONFIRMATION'
  | 'LIMIT_REACHED'
  | 'SEND_FAILED';

export class Os20EmailError extends Error {
  constructor(
    public readonly code: Os20EmailErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type Os20EmailSender = {
  connectedAccountId: string;
  fromEmail: string;
  fromName: string | null;
  host: string;
  port: number;
  secure: boolean;
  username: string;
};

export type Os20EmailStatus = {
  connected: boolean;
  sender: Os20EmailSender | null;
  dailyLimit: number;
  sentToday: number;
  remaining: number;
};

export type Os20EmailSendResult = {
  success: true;
  to: string;
  from: string;
  noteId: string | null;
  sentToday: number;
  remaining: number;
};

const isSmtpOnly = (account: ConnectedAccountEntity) =>
  !isDefined(account.connectionParameters?.IMAP) &&
  !isDefined(account.connectionParameters?.CALDAV);

const TEST_SUBJECT = 'OS20 test email';
const TEST_BODY =
  'This is a test email from OS20. If you can read it, sending works.';

@Injectable()
export class Os20EmailService {
  private readonly logger = new Logger(Os20EmailService.name);

  constructor(
    @InjectRepository(Os20EmailSettingsEntity)
    private readonly settingsRepository: Repository<Os20EmailSettingsEntity>,
    @InjectRepository(Os20EmailSendEntity)
    private readonly sendRepository: Repository<Os20EmailSendEntity>,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    private readonly connectedAccountMetadataService: ConnectedAccountMetadataService,
    private readonly connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionService,
    private readonly imapSmtpCaldavService: ImapSmtpCaldavService,
    private readonly imapSmtpCalDavApiService: ImapSmtpCalDavAPIService,
    private readonly emailComposerService: EmailComposerService,
    private readonly sendEmailService: SendEmailService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly os20EmailNoteService: Os20EmailNoteService,
  ) {}

  async getStatus(workspaceId: string): Promise<Os20EmailStatus> {
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });
    const account = await this.findSenderAccount(workspaceId, settings);
    const dailyLimit = settings?.dailyLimit ?? OS20_EMAIL_DEFAULT_DAILY_LIMIT;
    const sentToday = await this.countSentToday(workspaceId);

    return {
      connected: isDefined(account),
      sender: isDefined(account) ? this.toPublicSender(account) : null,
      dailyLimit,
      sentToday,
      remaining: Math.max(0, dailyLimit - sentToday),
    };
  }

  async saveSmtp(
    workspaceId: string,
    userWorkspaceId: string,
    input: Os20SmtpInput,
  ): Promise<Os20EmailStatus> {
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });
    const current = await this.findSenderAccount(workspaceId, settings);
    const existingAccount =
      isDefined(current) &&
      current.userWorkspaceId === userWorkspaceId &&
      current.handle === input.fromEmail
        ? current
        : null;

    if (!isDefined(existingAccount) && !isDefined(input.password)) {
      throw new Os20EmailValidationError('password is required');
    }

    const existingParameters = isDefined(existingAccount?.connectionParameters)
      ? this.connectedAccountTokenEncryptionService.decryptConnectionParameters(
          {
            connectionParameters: existingAccount.connectionParameters,
            workspaceId,
          },
        )
      : null;

    const validated =
      await this.imapSmtpCaldavService.validateAndTestConnectionParameters({
        connectionParameters: {
          name: input.fromName ?? '',
          SMTP: {
            host: input.host,
            port: input.port,
            username: input.username,
            password: input.password,
            connectionSecurity: toConnectionSecurity(input.secure),
          },
        },
        handle: input.fromEmail,
        existingConnectionParameters: existingParameters,
      });

    const connectedAccountId =
      await this.imapSmtpCalDavApiService.upsertConnectedAccount({
        handle: input.fromEmail,
        userWorkspaceId,
        workspaceId,
        connectionParameters: { ...existingParameters, ...validated },
        existingAccount,
      });

    await this.settingsRepository.save({
      workspaceId,
      connectedAccountId,
      dailyLimit: input.dailyLimit,
    });

    if (
      isDefined(current) &&
      current.id !== connectedAccountId &&
      isSmtpOnly(current)
    ) {
      await this.deleteAccountQuietly(current.id, workspaceId);
    }

    return this.getStatus(workspaceId);
  }

  async deleteSmtp(workspaceId: string): Promise<Os20EmailStatus> {
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });
    const account = await this.findSenderAccount(workspaceId, settings);

    if (isDefined(settings)) {
      await this.settingsRepository.save({
        ...settings,
        connectedAccountId: null,
      });
    }

    if (isDefined(account) && isSmtpOnly(account)) {
      await this.deleteAccountQuietly(account.id, workspaceId);
    }

    return this.getStatus(workspaceId);
  }

  async sendTest(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<{ success: true; to: string }> {
    const account = await this.resolveSender(workspaceId, userWorkspaceId);
    const to = account.handle ?? '';

    await this.deliver({
      account,
      workspaceId,
      userWorkspaceId,
      to,
      subject: TEST_SUBJECT,
      text: TEST_BODY,
    });
    await this.recordSend({
      workspaceId,
      kind: 'test',
      personId: null,
      connectedAccountId: account.id,
      toEmail: to,
      subject: TEST_SUBJECT,
    });

    return { success: true, to };
  }

  async sendToPerson(
    workspaceId: string,
    userWorkspaceId: string,
    input: Os20SendInput,
  ): Promise<Os20EmailSendResult> {
    const account = await this.resolveSender(workspaceId, userWorkspaceId);
    const person = await this.findPerson(workspaceId, input.personId);

    if (!isDefined(person)) {
      throw new Os20EmailError('PERSON_NOT_FOUND', 'Person not found');
    }

    const to = person.emails?.primaryEmail?.trim().toLowerCase() ?? '';
    const refusal = getRecipientRefusal({
      email: to,
      emailStatus: person.emailStatus,
      confirm: input.confirm,
    });

    if (refusal === 'NO_EMAIL') {
      throw new Os20EmailError('NO_EMAIL', 'This person has no email address');
    }

    if (refusal === 'INVALID_EMAIL') {
      throw new Os20EmailError(
        'INVALID_EMAIL',
        'This person has an invalid email address',
      );
    }

    if (refusal === 'NEEDS_CONFIRMATION') {
      throw new Os20EmailError(
        'NEEDS_CONFIRMATION',
        `This email is ${String(person.emailStatus).toLowerCase()}. Confirm to send anyway.`,
      );
    }

    const dailyLimit = await this.getDailyLimit(workspaceId);
    const reservation = await this.reserveSend({
      workspaceId,
      dailyLimit,
      personId: person.id,
      connectedAccountId: account.id,
      toEmail: to,
      subject: input.subject,
    });

    try {
      await this.deliver({
        account,
        workspaceId,
        userWorkspaceId,
        to,
        subject: input.subject,
        text: input.body,
      });
    } catch (error) {
      await this.sendRepository.delete({ id: reservation.id });
      throw error;
    }

    const from = account.handle ?? '';
    const noteId = await this.os20EmailNoteService.logSentEmail({
      workspaceId,
      personId: person.id,
      from,
      to,
      subject: input.subject,
      body: input.body,
    });

    return {
      success: true,
      to,
      from,
      noteId,
      sentToday: reservation.sentToday,
      remaining: Math.max(0, dailyLimit - reservation.sentToday),
    };
  }

  private async deliver({
    account,
    workspaceId,
    userWorkspaceId,
    to,
    subject,
    text,
  }: {
    account: ConnectedAccountEntity;
    workspaceId: string;
    userWorkspaceId: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<void> {
    const composed = await this.emailComposerService.composeEmail(
      {
        recipients: { to, cc: '', bcc: '' },
        subject,
        body: plainTextToHtml(text),
        connectedAccountId: account.id,
        files: [],
      },
      { workspaceId, userWorkspaceId },
    );

    if (!composed.success) {
      throw new Os20EmailError(
        'SEND_FAILED',
        composed.output.error ?? composed.output.message,
      );
    }

    try {
      const result = await this.sendEmailService.sendComposedEmail(
        composed.data,
      );

      if (composed.data.shouldPersistMessage) {
        await this.sendEmailService
          .persistSentMessage(result, composed.data, workspaceId)
          .catch((error) =>
            this.logger.warn(`Sent message not persisted: ${error}`),
          );
      }
    } catch (error) {
      throw new Os20EmailError(
        'SEND_FAILED',
        `Could not send the email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async reserveSend({
    workspaceId,
    dailyLimit,
    personId,
    connectedAccountId,
    toEmail,
    subject,
  }: {
    workspaceId: string;
    dailyLimit: number;
    personId: string;
    connectedAccountId: string;
    toEmail: string;
    subject: string;
  }): Promise<{ id: string; sentToday: number }> {
    const limitError = () =>
      new Os20EmailError(
        'LIMIT_REACHED',
        `Daily sending limit reached (${dailyLimit} emails). Try again tomorrow or raise the limit in Settings.`,
      );

    if ((await this.countSentToday(workspaceId)) >= dailyLimit) {
      throw limitError();
    }

    const reservation = await this.recordSend({
      workspaceId,
      kind: 'outreach',
      personId,
      connectedAccountId,
      toEmail,
      subject,
    });
    const sentToday = await this.countSentToday(workspaceId);

    if (sentToday > dailyLimit) {
      await this.sendRepository.delete({ id: reservation.id });
      throw limitError();
    }

    return { id: reservation.id, sentToday };
  }

  private async recordSend(send: {
    workspaceId: string;
    kind: Os20EmailSendKind;
    personId: string | null;
    connectedAccountId: string;
    toEmail: string;
    subject: string;
  }): Promise<Os20EmailSendEntity> {
    return this.sendRepository.save(this.sendRepository.create(send));
  }

  private countSentToday(workspaceId: string): Promise<number> {
    return this.sendRepository.count({
      where: {
        workspaceId,
        kind: 'outreach',
        createdAt: MoreThanOrEqual(startOfUtcDay(new Date())),
      },
    });
  }

  private async getDailyLimit(workspaceId: string): Promise<number> {
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    return settings?.dailyLimit ?? OS20_EMAIL_DEFAULT_DAILY_LIMIT;
  }

  private async resolveSender(
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<ConnectedAccountEntity> {
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });
    const account = await this.findSenderAccount(workspaceId, settings);

    if (!isDefined(account)) {
      throw new Os20EmailError(
        'NO_SENDER',
        'Connect an email account in Settings > Email sending first',
      );
    }

    await this.connectedAccountMetadataService.verifyOwnership({
      id: account.id,
      userWorkspaceId,
      workspaceId,
    });

    return account;
  }

  private async findSenderAccount(
    workspaceId: string,
    settings: Os20EmailSettingsEntity | null,
  ): Promise<ConnectedAccountEntity | null> {
    if (!isDefined(settings?.connectedAccountId)) return null;

    const account = await this.connectedAccountRepository.findOne({
      where: { id: settings.connectedAccountId, workspaceId },
    });

    if (
      !isDefined(account) ||
      account.provider !== ConnectedAccountProvider.IMAP_SMTP_CALDAV ||
      !isDefined(account.connectionParameters?.SMTP)
    ) {
      return null;
    }

    return account;
  }

  private toPublicSender(account: ConnectedAccountEntity): Os20EmailSender {
    const smtp = account.connectionParameters?.SMTP;

    return {
      connectedAccountId: account.id,
      fromEmail: account.handle ?? '',
      fromName: account.connectionParameters?.name ?? null,
      host: smtp?.host ?? '',
      port: smtp?.port ?? 0,
      secure: smtp?.connectionSecurity === EmailConnectionSecurity.SSL_TLS,
      username: smtp?.username ?? account.handle ?? '',
    };
  }

  private findPerson(
    workspaceId: string,
    personId: string,
  ): Promise<PersonWorkspaceEntity | null> {
    return this.workspaceOrmManager.executeInWorkspaceContext(
      async () =>
        this.workspaceOrmManager
          .getRepository(PersonWorkspaceEntity, {
            shouldBypassPermissionChecks: true,
          })
          .findOne({ where: { id: personId } }),
      buildSystemAuthContext(workspaceId),
    );
  }

  private async deleteAccountQuietly(id: string, workspaceId: string) {
    try {
      await this.connectedAccountMetadataService.delete({ id, workspaceId });
    } catch (error) {
      this.logger.warn(`Could not remove old sender account ${id}: ${error}`);
    }
  }
}
