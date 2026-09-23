import { type Os20EmailSender } from '@/os20-email/types/Os20EmailSender';
import { type Os20EmailSenderStatus } from '@/os20-email/types/Os20EmailSenderStatus';

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;

const parseSender = (value: unknown): Os20EmailSender | null => {
  if (typeof value !== 'object' || value === null) return null;

  const sender = value as Record<string, unknown>;

  if (
    typeof sender.connectedAccountId !== 'string' ||
    typeof sender.fromEmail !== 'string' ||
    sender.fromEmail.length === 0
  ) {
    return null;
  }

  return {
    connectedAccountId: sender.connectedAccountId,
    fromEmail: sender.fromEmail,
    fromName:
      typeof sender.fromName === 'string' && sender.fromName.length > 0
        ? sender.fromName
        : null,
    host: typeof sender.host === 'string' ? sender.host : '',
    port: toCount(sender.port),
    secure: sender.secure === true,
    username: typeof sender.username === 'string' ? sender.username : '',
  };
};

export const parseOs20EmailSenderStatus = (
  body: unknown,
): Os20EmailSenderStatus | null => {
  if (typeof body !== 'object' || body === null) return null;

  const status = body as Record<string, unknown>;
  const sender = parseSender(status.sender);
  const dailyLimit = toCount(status.dailyLimit);
  const sentToday = toCount(status.sentToday);

  return {
    connected: status.connected === true && sender !== null,
    sender,
    dailyLimit,
    sentToday,
    remaining:
      typeof status.remaining === 'number'
        ? toCount(status.remaining)
        : Math.max(0, dailyLimit - sentToday),
  };
};
