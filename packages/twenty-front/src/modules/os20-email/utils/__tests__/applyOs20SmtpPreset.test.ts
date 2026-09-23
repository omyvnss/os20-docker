import { type Os20SmtpForm } from '@/os20-email/types/Os20SmtpForm';
import { applyOs20SmtpPreset } from '@/os20-email/utils/applyOs20SmtpPreset';
import { detectOs20SmtpPreset } from '@/os20-email/utils/detectOs20SmtpPreset';

const baseForm: Os20SmtpForm = {
  presetId: 'custom',
  host: 'mail.example.com',
  port: '2525',
  secure: false,
  username: 'me@example.com',
  password: 'secret',
  fromName: 'Me',
  fromEmail: 'me@example.com',
  dailyLimit: '30',
};

describe('applyOs20SmtpPreset', () => {
  it('fills Gmail server details and keeps the username', () => {
    expect(applyOs20SmtpPreset(baseForm, 'gmail')).toEqual({
      ...baseForm,
      presetId: 'gmail',
      host: 'smtp.gmail.com',
      port: '465',
      secure: true,
    });
  });

  it('uses STARTTLS on 587 for Outlook', () => {
    expect(applyOs20SmtpPreset(baseForm, 'outlook')).toMatchObject({
      host: 'smtp.office365.com',
      port: '587',
      secure: false,
    });
  });

  it('forces the resend username and clears it when switching away', () => {
    const resend = applyOs20SmtpPreset(baseForm, 'resend');

    expect(resend).toMatchObject({
      host: 'smtp.resend.com',
      port: '465',
      secure: true,
      username: 'resend',
    });
    expect(applyOs20SmtpPreset(resend, 'zoho').username).toBe('');
  });

  it('keeps typed values for custom', () => {
    expect(applyOs20SmtpPreset(baseForm, 'custom')).toEqual(baseForm);
  });
});

describe('detectOs20SmtpPreset', () => {
  it('maps known hosts and falls back to custom', () => {
    expect(detectOs20SmtpPreset(' SMTP.gmail.com ')).toBe('gmail');
    expect(detectOs20SmtpPreset('smtp.resend.com')).toBe('resend');
    expect(detectOs20SmtpPreset('mail.example.com')).toBe('custom');
    expect(detectOs20SmtpPreset('')).toBe('custom');
  });
});
