import { type Os20OutreachDraft } from '@/os20-contacts/types/Os20OutreachDraft';

export const parseOutreachDraft = (data: unknown): Os20OutreachDraft | null => {
  if (typeof data !== 'object' || data === null) return null;

  const { subject, body } = data as { subject?: unknown; body?: unknown };

  if (typeof subject !== 'string' && typeof body !== 'string') return null;

  return {
    subject: typeof subject === 'string' ? subject.trim() : '',
    body: typeof body === 'string' ? body.trim() : '',
  };
};
