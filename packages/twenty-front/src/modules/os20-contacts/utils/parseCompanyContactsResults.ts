import { type Os20CompanyContactsResult } from '@/os20-contacts/types/Os20CompanyContactsResult';
import { type Os20SavedContact } from '@/os20-contacts/types/Os20SavedContact';
import { isOs20EmailStatus } from '@/os20-contacts/utils/isOs20EmailStatus';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;

const parseContact = (value: unknown): Os20SavedContact | null => {
  if (!isRecord(value)) return null;

  const email = toText(value.email);
  const name = toText(value.name) ?? email;

  if (name === null) return null;

  return {
    id: toText(value.id) ?? undefined,
    name,
    jobTitle: toText(value.jobTitle),
    email,
    emailStatus: isOs20EmailStatus(value.emailStatus)
      ? value.emailStatus
      : null,
    saved: value.saved === true,
    reason: toText(value.reason) ?? undefined,
  };
};

const parseResult = (value: unknown): Os20CompanyContactsResult | null => {
  if (!isRecord(value)) return null;

  const companyId = toText(value.companyId);

  if (companyId === null) return null;

  const people = Array.isArray(value.people)
    ? value.people
        .map(parseContact)
        .filter((contact): contact is Os20SavedContact => contact !== null)
    : [];

  return {
    companyId,
    companyName: toText(value.companyName) ?? '',
    created: toCount(value.created),
    skipped: toCount(value.skipped),
    people,
    error: toText(value.error) ?? undefined,
  };
};

export const parseCompanyContactsResults = (
  data: unknown,
): Os20CompanyContactsResult[] => {
  if (!isRecord(data) || !Array.isArray(data.results)) return [];

  return data.results
    .map(parseResult)
    .filter((result): result is Os20CompanyContactsResult => result !== null);
};
