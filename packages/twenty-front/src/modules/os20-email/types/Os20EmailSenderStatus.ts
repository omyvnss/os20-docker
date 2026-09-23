import { type Os20EmailSender } from '@/os20-email/types/Os20EmailSender';

export type Os20EmailSenderStatus = {
  connected: boolean;
  sender: Os20EmailSender | null;
  dailyLimit: number;
  sentToday: number;
  remaining: number;
};
