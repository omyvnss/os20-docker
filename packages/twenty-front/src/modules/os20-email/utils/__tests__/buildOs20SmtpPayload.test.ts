import { type Os20SmtpForm } from '@/os20-email/types/Os20SmtpForm';
import { buildOs20SmtpPayload } from '@/os20-email/utils/buildOs20SmtpPayload';
import { getOs20SmtpFormError } from '@/os20-email/utils/getOs20SmtpFormError';

const form: Os20SmtpForm = {
  presetId: 'gmail',
  host: ' smtp.gmail.com ',
  port: '465',
  secure: true,
  username: ' ',
  password: ' app-password ',
  fromName: ' Om ',
  fromEmail: ' om@example.com ',
  dailyLimit: '25',
};

describe('buildOs20SmtpPayload', () => {
  it('trims values and defaults the username to the from email', () => {
    expect(buildOs20SmtpPayload(form)).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      username: 'om@example.com',
      password: 'app-password',
      fromName: 'Om',
      fromEmail: 'om@example.com',
      dailyLimit: 25,
    });
  });

  it('omits an empty password so the saved one is kept', () => {
    expect(
      buildOs20SmtpPayload({ ...form, password: '  ' }),
    ).not.toHaveProperty('password');
  });
});

describe('getOs20SmtpFormError', () => {
  it('accepts a complete form', () => {
    expect(getOs20SmtpFormError(form, { hasSavedPassword: false })).toBeNull();
  });

  it('flags missing or invalid fields', () => {
    expect(
      getOs20SmtpFormError(
        { ...form, fromEmail: 'nope' },
        { hasSavedPassword: false },
      ),
    ).not.toBeNull();
    expect(
      getOs20SmtpFormError({ ...form, host: ' ' }, { hasSavedPassword: false }),
    ).not.toBeNull();
    expect(
      getOs20SmtpFormError({ ...form, port: '0' }, { hasSavedPassword: false }),
    ).not.toBeNull();
    expect(
      getOs20SmtpFormError(
        { ...form, dailyLimit: '501' },
        { hasSavedPassword: false },
      ),
    ).not.toBeNull();
  });

  it('requires a password only when none is saved', () => {
    const withoutPassword = { ...form, password: '' };

    expect(
      getOs20SmtpFormError(withoutPassword, { hasSavedPassword: false }),
    ).not.toBeNull();
    expect(
      getOs20SmtpFormError(withoutPassword, { hasSavedPassword: true }),
    ).toBeNull();
  });
});
