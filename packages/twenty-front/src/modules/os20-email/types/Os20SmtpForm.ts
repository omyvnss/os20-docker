import { type Os20SmtpPresetId } from '@/os20-email/types/Os20SmtpPresetId';

export type Os20SmtpForm = {
  presetId: Os20SmtpPresetId;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  dailyLimit: string;
};
