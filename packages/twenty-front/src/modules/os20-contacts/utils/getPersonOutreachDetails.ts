import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';
import { isOs20EmailStatus } from '@/os20-contacts/utils/isOs20EmailStatus';

export type PersonOutreachDetails = {
  personName: string | null;
  primaryEmail: string | null;
  emailStatus: Os20EmailStatus | null;
};

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const getPersonOutreachDetails = (
  record: Record<string, unknown> | null | undefined,
): PersonOutreachDetails => {
  const name = (record?.name ?? null) as {
    firstName?: unknown;
    lastName?: unknown;
  } | null;
  const emails = (record?.emails ?? null) as { primaryEmail?: unknown } | null;
  const fullName = [toText(name?.firstName), toText(name?.lastName)]
    .filter((part): part is string => part !== null)
    .join(' ');

  return {
    personName: fullName.length > 0 ? fullName : null,
    primaryEmail: toText(emails?.primaryEmail),
    emailStatus: isOs20EmailStatus(record?.emailStatus)
      ? record.emailStatus
      : null,
  };
};
