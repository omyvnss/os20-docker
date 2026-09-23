import { EmailConnectionSecurity } from 'src/engine/core-modules/imap-smtp-caldav-connection/enums/email-connection-security.enum';
import {
  OS20_EMAIL_DEFAULT_DAILY_LIMIT,
  Os20EmailValidationError,
  getRecipientRefusal,
  parseDailyLimit,
  parseSendInput,
  parseSmtpInput,
  plainTextToHtml,
  startOfUtcDay,
  toConnectionSecurity,
} from 'src/engine/core-modules/os20-email/utils/os20-email-rules.util';

const PERSON_ID = '4f1c2b7e-8a8d-4e1a-9d7c-1f2e3d4c5b6a';

describe('parseSmtpInput', () => {
  it('parses a Resend style config and defaults secure from port 465', () => {
    expect(
      parseSmtpInput(
        {
          host: ' SMTP.resend.com ',
          port: '465',
          username: 'resend',
          password: 're_123',
          fromName: ' Om ',
          fromEmail: 'Om@Example.com',
        },
        { requirePassword: true },
      ),
    ).toEqual({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      username: 'resend',
      password: 're_123',
      fromName: 'Om',
      fromEmail: 'om@example.com',
      dailyLimit: OS20_EMAIL_DEFAULT_DAILY_LIMIT,
    });
  });

  it('uses the from email as username and keeps explicit secure flag', () => {
    const input = parseSmtpInput(
      {
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        fromEmail: 'me@outlook.com',
        password: 'pw',
        dailyLimit: 10,
      },
      { requirePassword: true },
    );

    expect(input.username).toBe('me@outlook.com');
    expect(input.secure).toBe(false);
    expect(input.dailyLimit).toBe(10);
    expect(input.fromName).toBeUndefined();
  });

  it('allows a missing password on update only', () => {
    const body = { host: 'smtp.gmail.com', port: 465, fromEmail: 'a@b.co' };

    expect(parseSmtpInput(body, { requirePassword: false }).password).toBe(
      undefined,
    );
    expect(() => parseSmtpInput(body, { requirePassword: true })).toThrow(
      Os20EmailValidationError,
    );
  });

  it.each([
    [{ host: 'localhost', port: 25, fromEmail: 'a@b.co', password: 'x' }],
    [{ host: 'smtp.x.com', port: 0, fromEmail: 'a@b.co', password: 'x' }],
    [{ host: 'smtp.x.com', port: 70000, fromEmail: 'a@b.co', password: 'x' }],
    [{ host: 'smtp.x.com', port: 465, fromEmail: 'nope', password: 'x' }],
    [{ host: 'smtp x.com', port: 465, fromEmail: 'a@b.co', password: 'x' }],
    [null],
  ])('rejects invalid input %#', (body) => {
    expect(() => parseSmtpInput(body, { requirePassword: true })).toThrow(
      Os20EmailValidationError,
    );
  });
});

describe('parseDailyLimit', () => {
  it('defaults to 30 and enforces bounds', () => {
    expect(parseDailyLimit(undefined)).toBe(30);
    expect(parseDailyLimit('50')).toBe(50);
    expect(() => parseDailyLimit(0)).toThrow(Os20EmailValidationError);
    expect(() => parseDailyLimit(501)).toThrow(Os20EmailValidationError);
    expect(() => parseDailyLimit(2.5)).toThrow(Os20EmailValidationError);
  });
});

describe('parseSendInput', () => {
  it('trims fields, strips header newlines and reads confirm strictly', () => {
    expect(
      parseSendInput({
        personId: PERSON_ID,
        subject: ' Hello\r\nBcc: x@y.z ',
        body: ' Hi there ',
        confirm: 'true',
      }),
    ).toEqual({
      personId: PERSON_ID,
      subject: 'Hello Bcc: x@y.z',
      body: 'Hi there',
      confirm: false,
    });
  });

  it.each([
    [{ personId: 'x', subject: 's', body: 'b' }],
    [{ personId: PERSON_ID, subject: ' ', body: 'b' }],
    [{ personId: PERSON_ID, subject: 's', body: '' }],
    [{ personId: PERSON_ID, subject: 's'.repeat(301), body: 'b' }],
  ])('rejects invalid send input %#', (body) => {
    expect(() => parseSendInput(body)).toThrow(Os20EmailValidationError);
  });
});

describe('getRecipientRefusal', () => {
  it('refuses guessed and invalid emails without confirmation', () => {
    expect(
      getRecipientRefusal({
        email: 'a@b.co',
        emailStatus: 'GUESSED',
        confirm: false,
      }),
    ).toBe('NEEDS_CONFIRMATION');
    expect(
      getRecipientRefusal({
        email: 'a@b.co',
        emailStatus: 'INVALID',
        confirm: false,
      }),
    ).toBe('NEEDS_CONFIRMATION');
  });

  it('allows risky statuses with confirmation and verified without', () => {
    expect(
      getRecipientRefusal({
        email: 'a@b.co',
        emailStatus: 'GUESSED',
        confirm: true,
      }),
    ).toBeNull();
    expect(
      getRecipientRefusal({
        email: 'a@b.co',
        emailStatus: 'VERIFIED',
        confirm: false,
      }),
    ).toBeNull();
    expect(
      getRecipientRefusal({
        email: 'a@b.co',
        emailStatus: null,
        confirm: false,
      }),
    ).toBeNull();
  });

  it('refuses missing or malformed addresses', () => {
    expect(
      getRecipientRefusal({ email: '', emailStatus: null, confirm: true }),
    ).toBe('NO_EMAIL');
    expect(
      getRecipientRefusal({ email: 'a@b', emailStatus: null, confirm: true }),
    ).toBe('INVALID_EMAIL');
  });
});

describe('formatting helpers', () => {
  it('turns plain text into escaped paragraphs with line breaks', () => {
    expect(plainTextToHtml('Hi <Jane>,\r\nline two\n\n\nBye & thanks')).toBe(
      '<p>Hi &lt;Jane&gt;,<br>line two</p><p>Bye &amp; thanks</p>',
    );
  });

  it('computes the UTC day start and connection security', () => {
    expect(
      startOfUtcDay(new Date('2026-09-21T23:59:00.000Z')).toISOString(),
    ).toBe('2026-09-21T00:00:00.000Z');
    expect(toConnectionSecurity(true)).toBe(EmailConnectionSecurity.SSL_TLS);
    expect(toConnectionSecurity(false)).toBe(EmailConnectionSecurity.STARTTLS);
  });
});
