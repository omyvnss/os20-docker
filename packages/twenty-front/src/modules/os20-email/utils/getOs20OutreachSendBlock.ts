import { type Os20EmailSenderStatus } from '@/os20-email/types/Os20EmailSenderStatus';
import { type Os20OutreachSendBlock } from '@/os20-email/types/Os20OutreachSendBlock';

export const getOs20OutreachSendBlock = ({
  status,
  isLoading,
  primaryEmail,
}: {
  status: Os20EmailSenderStatus | null;
  isLoading: boolean;
  primaryEmail: string | null;
}): Os20OutreachSendBlock | null => {
  if (status === null) return isLoading ? 'LOADING' : 'NO_SENDER';

  if (!status.connected) return 'NO_SENDER';

  if (primaryEmail === null || primaryEmail.trim().length === 0) {
    return 'NO_EMAIL';
  }

  if (status.remaining <= 0) return 'LIMIT_REACHED';

  return null;
};
