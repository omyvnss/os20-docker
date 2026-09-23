import { HttpStatus } from '@nestjs/common';

import { ConnectedAccountProvider } from 'twenty-shared/types';

import { toOs20EmailHttpError } from 'src/engine/core-modules/os20-email/os20-email.controller';
import {
  Os20EmailError,
  Os20EmailService,
} from 'src/engine/core-modules/os20-email/services/os20-email.service';
import { Os20EmailValidationError } from 'src/engine/core-modules/os20-email/utils/os20-email-rules.util';

jest.mock(
  'src/engine/core-modules/tool/tools/email-tool/email-composer.service',
  () => ({ EmailComposerService: class {} }),
);
jest.mock(
  'src/modules/messaging/message-outbound-manager/services/send-email.service',
  () => ({ SendEmailService: class {} }),
);
jest.mock(
  'src/engine/core-modules/imap-smtp-caldav-connection/services/imap-smtp-caldav-connection.service',
  () => ({ ImapSmtpCaldavService: class {} }),
);
jest.mock(
  'src/modules/connected-account/services/imap-smtp-caldav-apis.service',
  () => ({ ImapSmtpCalDavAPIService: class {} }),
);
jest.mock(
  'src/engine/metadata-modules/connected-account/connected-account-metadata.service',
  () => ({ ConnectedAccountMetadataService: class {} }),
);
jest.mock(
  'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service',
  () => ({ ConnectedAccountTokenEncryptionService: class {} }),
);
jest.mock('src/engine/twenty-orm/workspace-orm.manager', () => ({
  WorkspaceOrmManager: class {},
}));
jest.mock(
  'src/engine/core-modules/os20-email/services/os20-email-note.service',
  () => ({ Os20EmailNoteService: class {} }),
);
jest.mock('src/engine/twenty-orm/utils/build-system-auth-context.util', () => ({
  buildSystemAuthContext: jest.fn(() => ({})),
}));

const WORKSPACE_ID = 'workspace-1';
const USER_WORKSPACE_ID = 'user-workspace-1';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const PERSON_ID = '22222222-2222-4222-8222-222222222222';

type SendRow = { id: string; workspaceId: string; kind: string };

const buildHarness = ({
  dailyLimit = 30,
  sentToday = 0,
  person = {
    id: PERSON_ID,
    emails: { primaryEmail: 'Jane@Acme.com' },
    emailStatus: 'VERIFIED',
  } as Record<string, unknown> | null,
  hasSender = true,
  transportError = null as Error | null,
} = {}) => {
  const rows: SendRow[] = Array.from({ length: sentToday }, (_, index) => ({
    id: `existing-${index}`,
    workspaceId: WORKSPACE_ID,
    kind: 'outreach',
  }));

  const settingsRepository = {
    findOne: jest.fn(async () =>
      hasSender
        ? {
            workspaceId: WORKSPACE_ID,
            connectedAccountId: ACCOUNT_ID,
            dailyLimit,
          }
        : null,
    ),
    save: jest.fn(async (value) => value),
  };
  const sendRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      const row = { ...value, id: `row-${rows.length}` };

      rows.push(row);

      return row;
    }),
    delete: jest.fn(async ({ id }: { id: string }) => {
      const index = rows.findIndex((row) => row.id === id);

      if (index >= 0) rows.splice(index, 1);
    }),
    count: jest.fn(
      async ({ where }: { where: { workspaceId: string; kind: string } }) =>
        rows.filter(
          (row) =>
            row.workspaceId === where.workspaceId && row.kind === where.kind,
        ).length,
    ),
  };
  const account = {
    id: ACCOUNT_ID,
    handle: 'me@example.com',
    provider: ConnectedAccountProvider.IMAP_SMTP_CALDAV,
    userWorkspaceId: USER_WORKSPACE_ID,
    connectionParameters: {
      name: 'Me',
      SMTP: {
        host: 'smtp.resend.com',
        port: 465,
        username: 'resend',
        password: 'enc:v2:secret',
        connectionSecurity: 'SSL_TLS',
      },
    },
  };
  const connectedAccountRepository = {
    findOne: jest.fn(async () => account),
  };
  const connectedAccountMetadataService = {
    verifyOwnership: jest.fn(async () => account),
    delete: jest.fn(),
  };
  const transport = jest.fn(async () => {
    if (transportError) throw transportError;

    return { headerMessageId: '<id@example.com>' };
  });
  const emailComposerService = {
    composeEmail: jest.fn(async (params) => ({
      success: true,
      data: {
        ...params,
        connectedAccount: account,
        shouldPersistMessage: false,
      },
    })),
  };
  const sendEmailService = {
    sendComposedEmail: transport,
    persistSentMessage: jest.fn(),
  };
  const workspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(async (callback: () => unknown) =>
      callback(),
    ),
    getRepository: jest.fn(() => ({ findOne: jest.fn(async () => person) })),
  };
  const noteService = { logSentEmail: jest.fn(async () => 'note-1') };
  const imapSmtpCaldavService = {
    validateAndTestConnectionParameters: jest.fn(
      async ({ connectionParameters }) => ({
        name: connectionParameters.name,
        SMTP: {
          ...connectionParameters.SMTP,
          password: connectionParameters.SMTP.password ?? 'old-password',
        },
      }),
    ),
  };
  const imapSmtpCalDavApiService = {
    upsertConnectedAccount: jest.fn(async () => ACCOUNT_ID),
  };
  const encryptionService = {
    decryptConnectionParameters: jest.fn(() => ({
      name: 'Me',
      SMTP: { ...account.connectionParameters.SMTP, password: 'old-password' },
    })),
  };

  const service = new Os20EmailService(
    settingsRepository as never,
    sendRepository as never,
    connectedAccountRepository as never,
    connectedAccountMetadataService as never,
    encryptionService as never,
    imapSmtpCaldavService as never,
    imapSmtpCalDavApiService as never,
    emailComposerService as never,
    sendEmailService as never,
    workspaceOrmManager as never,
    noteService as never,
  );

  return {
    service,
    rows,
    transport,
    emailComposerService,
    noteService,
    settingsRepository,
    imapSmtpCaldavService,
    imapSmtpCalDavApiService,
  };
};

const sendInput = (overrides = {}) => ({
  personId: PERSON_ID,
  subject: 'Quick idea',
  body: 'Hi Jane,\nShort note.',
  confirm: false,
  ...overrides,
});

describe('Os20EmailService.sendToPerson', () => {
  it('sends to the primary email, logs a note and reports the quota', async () => {
    const harness = buildHarness({ dailyLimit: 3, sentToday: 1 });

    const result = await harness.service.sendToPerson(
      WORKSPACE_ID,
      USER_WORKSPACE_ID,
      sendInput(),
    );

    expect(result).toEqual({
      success: true,
      to: 'jane@acme.com',
      from: 'me@example.com',
      noteId: 'note-1',
      sentToday: 2,
      remaining: 1,
    });
    expect(harness.emailComposerService.composeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: { to: 'jane@acme.com', cc: '', bcc: '' },
        subject: 'Quick idea',
        body: '<p>Hi Jane,<br>Short note.</p>',
        connectedAccountId: ACCOUNT_ID,
      }),
      { workspaceId: WORKSPACE_ID, userWorkspaceId: USER_WORKSPACE_ID },
    );
    expect(harness.transport).toHaveBeenCalledTimes(1);
    expect(harness.noteService.logSentEmail).toHaveBeenCalledWith(
      expect.objectContaining({ personId: PERSON_ID, to: 'jane@acme.com' }),
    );
  });

  it('refuses once the daily limit is reached without sending', async () => {
    const harness = buildHarness({ dailyLimit: 2, sentToday: 2 });

    await expect(
      harness.service.sendToPerson(
        WORKSPACE_ID,
        USER_WORKSPACE_ID,
        sendInput(),
      ),
    ).rejects.toMatchObject({ code: 'LIMIT_REACHED' });
    expect(harness.transport).not.toHaveBeenCalled();
    expect(harness.rows).toHaveLength(2);
  });

  it('refuses guessed emails unless confirmed', async () => {
    const person = {
      id: PERSON_ID,
      emails: { primaryEmail: 'jane@acme.com' },
      emailStatus: 'GUESSED',
    };
    const refused = buildHarness({ person });

    await expect(
      refused.service.sendToPerson(
        WORKSPACE_ID,
        USER_WORKSPACE_ID,
        sendInput(),
      ),
    ).rejects.toMatchObject({ code: 'NEEDS_CONFIRMATION' });
    expect(refused.transport).not.toHaveBeenCalled();

    const confirmed = buildHarness({ person });

    await expect(
      confirmed.service.sendToPerson(
        WORKSPACE_ID,
        USER_WORKSPACE_ID,
        sendInput({ confirm: true }),
      ),
    ).resolves.toMatchObject({ success: true });
  });

  it('refuses invalid status, missing email and unknown people', async () => {
    await expect(
      buildHarness({
        person: {
          id: PERSON_ID,
          emails: { primaryEmail: 'jane@acme.com' },
          emailStatus: 'INVALID',
        },
      }).service.sendToPerson(WORKSPACE_ID, USER_WORKSPACE_ID, sendInput()),
    ).rejects.toMatchObject({ code: 'NEEDS_CONFIRMATION' });

    await expect(
      buildHarness({
        person: { id: PERSON_ID, emails: { primaryEmail: '' } },
      }).service.sendToPerson(WORKSPACE_ID, USER_WORKSPACE_ID, sendInput()),
    ).rejects.toMatchObject({ code: 'NO_EMAIL' });

    await expect(
      buildHarness({ person: null }).service.sendToPerson(
        WORKSPACE_ID,
        USER_WORKSPACE_ID,
        sendInput(),
      ),
    ).rejects.toMatchObject({ code: 'PERSON_NOT_FOUND' });
  });

  it('refuses when no sender is connected', async () => {
    await expect(
      buildHarness({ hasSender: false }).service.sendToPerson(
        WORKSPACE_ID,
        USER_WORKSPACE_ID,
        sendInput(),
      ),
    ).rejects.toMatchObject({ code: 'NO_SENDER' });
  });

  it('releases the quota slot when the transport fails', async () => {
    const harness = buildHarness({
      sentToday: 1,
      transportError: new Error('535 auth failed'),
    });

    await expect(
      harness.service.sendToPerson(
        WORKSPACE_ID,
        USER_WORKSPACE_ID,
        sendInput(),
      ),
    ).rejects.toMatchObject({ code: 'SEND_FAILED' });
    expect(harness.rows).toHaveLength(1);
    expect(harness.noteService.logSentEmail).not.toHaveBeenCalled();
  });
});

describe('Os20EmailService.sendTest', () => {
  it('sends a test email to the sender address through the transport', async () => {
    const harness = buildHarness({ dailyLimit: 1, sentToday: 1 });

    await expect(
      harness.service.sendTest(WORKSPACE_ID, USER_WORKSPACE_ID),
    ).resolves.toEqual({ success: true, to: 'me@example.com' });
    expect(harness.transport).toHaveBeenCalledTimes(1);
    expect(harness.emailComposerService.composeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: { to: 'me@example.com', cc: '', bcc: '' },
        subject: 'OS20 test email',
      }),
      expect.anything(),
    );
    expect(harness.rows.filter((row) => row.kind === 'test')).toHaveLength(1);
  });

  it('surfaces transport failures', async () => {
    await expect(
      buildHarness({
        transportError: new Error('ETIMEDOUT'),
      }).service.sendTest(WORKSPACE_ID, USER_WORKSPACE_ID),
    ).rejects.toMatchObject({
      code: 'SEND_FAILED',
      message: 'Could not send the email: ETIMEDOUT',
    });
  });
});

describe('Os20EmailService.getStatus and saveSmtp', () => {
  it('never returns the password', async () => {
    const status = await buildHarness({ sentToday: 4 }).service.getStatus(
      WORKSPACE_ID,
    );

    expect(status).toEqual({
      connected: true,
      sender: {
        connectedAccountId: ACCOUNT_ID,
        fromEmail: 'me@example.com',
        fromName: 'Me',
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        username: 'resend',
      },
      dailyLimit: 30,
      sentToday: 4,
      remaining: 26,
    });
    expect(JSON.stringify(status)).not.toContain('secret');
  });

  it('keeps the stored password when updating the same sender', async () => {
    const harness = buildHarness();

    await harness.service.saveSmtp(WORKSPACE_ID, USER_WORKSPACE_ID, {
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      username: 'resend',
      fromEmail: 'me@example.com',
      dailyLimit: 12,
    });

    expect(
      harness.imapSmtpCalDavApiService.upsertConnectedAccount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: 'me@example.com',
        connectionParameters: expect.objectContaining({
          SMTP: expect.objectContaining({ password: 'old-password' }),
        }),
      }),
    );
    expect(harness.settingsRepository.save).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: ACCOUNT_ID,
      dailyLimit: 12,
    });
  });

  it('requires a password for a new sender', async () => {
    await expect(
      buildHarness({ hasSender: false }).service.saveSmtp(
        WORKSPACE_ID,
        USER_WORKSPACE_ID,
        {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          username: 'me@gmail.com',
          fromEmail: 'me@gmail.com',
          dailyLimit: 30,
        },
      ),
    ).rejects.toBeInstanceOf(Os20EmailValidationError);
  });
});

describe('toOs20EmailHttpError', () => {
  it('maps rule errors to HTTP statuses', () => {
    expect(
      toOs20EmailHttpError(
        new Os20EmailError('LIMIT_REACHED', 'x'),
      ).getStatus(),
    ).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(
      toOs20EmailHttpError(
        new Os20EmailError('NEEDS_CONFIRMATION', 'x'),
      ).getStatus(),
    ).toBe(HttpStatus.CONFLICT);
    expect(
      toOs20EmailHttpError(new Os20EmailValidationError('bad')).getStatus(),
    ).toBe(HttpStatus.BAD_REQUEST);
    expect(toOs20EmailHttpError(new Error('boom')).getStatus()).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});
