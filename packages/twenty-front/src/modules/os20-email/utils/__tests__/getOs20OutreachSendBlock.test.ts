import { type Os20EmailSenderStatus } from '@/os20-email/types/Os20EmailSenderStatus';
import { formatOs20Sender } from '@/os20-email/utils/formatOs20Sender';
import { getOs20OutreachSendBlock } from '@/os20-email/utils/getOs20OutreachSendBlock';
import { isRiskyOs20EmailStatus } from '@/os20-email/utils/isRiskyOs20EmailStatus';

const sender = {
  connectedAccountId: 'account-1',
  fromEmail: 'me@example.com',
  fromName: 'Me',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  username: 'me@example.com',
};

const connected: Os20EmailSenderStatus = {
  connected: true,
  sender,
  dailyLimit: 30,
  sentToday: 2,
  remaining: 28,
};

describe('getOs20OutreachSendBlock', () => {
  it('allows sending with a sender, recipient and quota', () => {
    expect(
      getOs20OutreachSendBlock({
        status: connected,
        isLoading: false,
        primaryEmail: 'jane@acme.com',
      }),
    ).toBeNull();
  });

  it('reports loading, missing sender, missing email and limit', () => {
    expect(
      getOs20OutreachSendBlock({
        status: null,
        isLoading: true,
        primaryEmail: 'jane@acme.com',
      }),
    ).toBe('LOADING');
    expect(
      getOs20OutreachSendBlock({
        status: null,
        isLoading: false,
        primaryEmail: 'jane@acme.com',
      }),
    ).toBe('NO_SENDER');
    expect(
      getOs20OutreachSendBlock({
        status: { ...connected, connected: false, sender: null },
        isLoading: false,
        primaryEmail: 'jane@acme.com',
      }),
    ).toBe('NO_SENDER');
    expect(
      getOs20OutreachSendBlock({
        status: connected,
        isLoading: false,
        primaryEmail: null,
      }),
    ).toBe('NO_EMAIL');
    expect(
      getOs20OutreachSendBlock({
        status: { ...connected, sentToday: 30, remaining: 0 },
        isLoading: false,
        primaryEmail: 'jane@acme.com',
      }),
    ).toBe('LIMIT_REACHED');
  });
});

describe('isRiskyOs20EmailStatus', () => {
  it('flags guessed and invalid only', () => {
    expect(isRiskyOs20EmailStatus('GUESSED')).toBe(true);
    expect(isRiskyOs20EmailStatus('INVALID')).toBe(true);
    expect(isRiskyOs20EmailStatus('VERIFIED')).toBe(false);
    expect(isRiskyOs20EmailStatus('FOUND')).toBe(false);
    expect(isRiskyOs20EmailStatus(null)).toBe(false);
  });
});

describe('formatOs20Sender', () => {
  it('includes the name when present', () => {
    expect(formatOs20Sender(sender)).toBe('Me <me@example.com>');
    expect(formatOs20Sender({ ...sender, fromName: null })).toBe(
      'me@example.com',
    );
  });
});
