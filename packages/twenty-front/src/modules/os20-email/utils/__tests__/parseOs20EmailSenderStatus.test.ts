import { parseOs20EmailSenderStatus } from '@/os20-email/utils/parseOs20EmailSenderStatus';

describe('parseOs20EmailSenderStatus', () => {
  it('parses a connected sender', () => {
    expect(
      parseOs20EmailSenderStatus({
        connected: true,
        sender: {
          connectedAccountId: 'account-1',
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
      }),
    ).toEqual({
      connected: true,
      sender: {
        connectedAccountId: 'account-1',
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
  });

  it('treats a missing sender as disconnected and derives remaining', () => {
    expect(
      parseOs20EmailSenderStatus({
        connected: true,
        sender: null,
        dailyLimit: 10,
        sentToday: 3,
      }),
    ).toEqual({
      connected: false,
      sender: null,
      dailyLimit: 10,
      sentToday: 3,
      remaining: 7,
    });
  });

  it('rejects non objects', () => {
    expect(parseOs20EmailSenderStatus(null)).toBeNull();
    expect(parseOs20EmailSenderStatus('nope')).toBeNull();
  });
});
