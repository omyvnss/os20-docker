import { type Os20EmailSender } from '@/os20-email/types/Os20EmailSender';

export const formatOs20Sender = (sender: Os20EmailSender): string =>
  sender.fromName
    ? `${sender.fromName} <${sender.fromEmail}>`
    : sender.fromEmail;
