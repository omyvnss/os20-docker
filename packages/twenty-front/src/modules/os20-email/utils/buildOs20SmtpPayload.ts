import { type Os20SmtpForm } from '@/os20-email/types/Os20SmtpForm';

export type Os20SmtpPayload = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  dailyLimit: number;
};

export const buildOs20SmtpPayload = (form: Os20SmtpForm): Os20SmtpPayload => {
  const fromEmail = form.fromEmail.trim();
  const password = form.password.trim();

  return {
    host: form.host.trim(),
    port: Number(form.port),
    secure: form.secure,
    username: form.username.trim() || fromEmail,
    ...(password.length > 0 && { password }),
    fromName: form.fromName.trim(),
    fromEmail,
    dailyLimit: Number(form.dailyLimit),
  };
};
