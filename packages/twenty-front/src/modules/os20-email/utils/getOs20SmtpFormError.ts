import { t } from '@lingui/core/macro';

import { type Os20SmtpForm } from '@/os20-email/types/Os20SmtpForm';

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export const getOs20SmtpFormError = (
  form: Os20SmtpForm,
  { hasSavedPassword }: { hasSavedPassword: boolean },
): string | null => {
  if (!EMAIL_PATTERN.test(form.fromEmail.trim())) {
    return t`Enter the email address you send from.`;
  }

  if (form.host.trim().length === 0) {
    return t`Enter the SMTP server host.`;
  }

  const port = Number(form.port);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return t`Enter a port between 1 and 65535.`;
  }

  if (!hasSavedPassword && form.password.trim().length === 0) {
    return t`Enter the password or API key.`;
  }

  const dailyLimit = Number(form.dailyLimit);

  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 500) {
    return t`Daily limit must be between 1 and 500.`;
  }

  return null;
};
