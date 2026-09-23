import { msg } from '@lingui/core/macro';

import { type Os20SmtpPreset } from '@/os20-email/types/Os20SmtpPreset';

export const OS20_SMTP_PRESETS: Os20SmtpPreset[] = [
  {
    id: 'gmail',
    label: msg`Gmail`,
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    hint: msg`Use a Google app password (Google Account > Security > App passwords), not your normal password. 2-step verification must be on.`,
  },
  {
    id: 'outlook',
    label: msg`Outlook`,
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    hint: msg`Use your Microsoft 365 email and password, or an app password if 2-step verification is on. SMTP AUTH must be enabled for the mailbox.`,
  },
  {
    id: 'resend',
    label: msg`Resend`,
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    username: 'resend',
    hint: msg`The username is always "resend" and the password is your Resend API key. The from address must be on a domain you verified in Resend.`,
  },
  {
    id: 'zoho',
    label: msg`Zoho`,
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    hint: msg`Use your Zoho email and an app-specific password. Accounts in the EU or India use smtp.zoho.eu or smtp.zoho.in.`,
  },
  {
    id: 'custom',
    label: msg`Custom`,
    host: '',
    port: 587,
    secure: false,
    hint: msg`Enter the SMTP server details from your email provider. Port 465 uses SSL/TLS, port 587 uses STARTTLS.`,
  },
];
